# Unified SpaceWire HAL Design

The flight software must never directly call `STAR_*` functions or Linux socket syscalls.
All hardware interactions go through a HAL (`spw_hal_t`) that is configured at startup with
the correct backend. This allows the same application code to run on both the USB Brick Mk4
(ground testing) and the FPGA IP core (flight).

---

## HAL Interface Definition (`spw_hal.h`)

```c
#ifndef SPW_HAL_H
#define SPW_HAL_H

#include <stdint.h>
#include <stddef.h>

/* Opaque handle to a SpaceWire link */
typedef struct spw_link spw_link_t;

/* Error codes */
typedef enum {
    SPW_OK          =  0,
    SPW_ERR_GENERAL = -1,
    SPW_ERR_TIMEOUT = -2,
    SPW_ERR_EEP     = -3,    /* Received packet had EEP terminator */
    SPW_ERR_TRUNC   = -4,    /* Received packet was truncated */
    SPW_ERR_LINK    = -5,    /* Link is down or errored */
    SPW_ERR_NOMEM   = -6,
} spw_err_t;

/* Timecode callback: called (possibly from a signal handler) when a timecode arrives */
typedef void (*spw_timecode_cb_t)(uint8_t timecode, void *userdata);

/* Backend operations table — implemented by each backend */
typedef struct spw_backend_ops {
    /* Lifecycle */
    spw_err_t (*open)(spw_link_t *link, const char *name, int protocol);
    void      (*close)(spw_link_t *link);

    /* Link control */
    spw_err_t (*link_up)(spw_link_t *link);
    spw_err_t (*link_down)(spw_link_t *link);
    spw_err_t (*set_clk_rate)(spw_link_t *link, uint32_t hz);

    /* Data transfer */
    spw_err_t (*send)(spw_link_t *link, const void *buf, size_t len, int send_eep);
    spw_err_t (*recv)(spw_link_t *link, void *buf, size_t buflen,
                      size_t *out_len, int *out_eep, int timeout_ms);

    /* Timecodes */
    spw_err_t (*send_timecode)(spw_link_t *link, uint8_t value);
    spw_err_t (*register_timecode_rx)(spw_link_t *link,
                                       spw_timecode_cb_t cb, void *userdata);

    /* Diagnostics */
    spw_err_t (*get_stats)(spw_link_t *link,
                            uint64_t *rx_bytes, uint64_t *tx_bytes,
                            uint64_t *rx_pkts,  uint64_t *tx_pkts);
} spw_backend_ops_t;

/* Link handle — contains ops pointer and backend-private state */
struct spw_link {
    const spw_backend_ops_t *ops;
    void                    *priv;   /* Backend-specific data */
    char                     name[32];
};

/* Convenience wrappers (call through ops table) */
static inline spw_err_t spw_open(spw_link_t *l, const char *n, int proto)
    { return l->ops->open(l, n, proto); }
static inline void spw_close(spw_link_t *l)
    { l->ops->close(l); }
static inline spw_err_t spw_link_up(spw_link_t *l)
    { return l->ops->link_up(l); }
static inline spw_err_t spw_link_down(spw_link_t *l)
    { return l->ops->link_down(l); }
static inline spw_err_t spw_send(spw_link_t *l, const void *b, size_t n, int eep)
    { return l->ops->send(l, b, n, eep); }
static inline spw_err_t spw_recv(spw_link_t *l, void *b, size_t bl,
                                   size_t *ol, int *oe, int tms)
    { return l->ops->recv(l, b, bl, ol, oe, tms); }
static inline spw_err_t spw_send_timecode(spw_link_t *l, uint8_t v)
    { return l->ops->send_timecode(l, v); }

#endif /* SPW_HAL_H */
```

---

## Backend Registration Pattern

Each backend provides a `const spw_backend_ops_t *` pointer and an `init` function that
wires it into the `spw_link_t`:

```c
/* spw_backend_fpga.h */
const spw_backend_ops_t *spw_backend_fpga_ops(void);
spw_err_t spw_backend_fpga_init(spw_link_t *link, const char *ifname, int protocol);

/* spw_backend_brick.h */
const spw_backend_ops_t *spw_backend_brick_ops(void);
spw_err_t spw_backend_brick_init(spw_link_t *link, int device_index,
                                   unsigned char channel_number);
```

### Application startup (flight vs ground):

```c
spw_link_t link;

#ifdef TARGET_FPGA
    spw_backend_fpga_init(&link, "spw0", SPW_RMAP);
#else
    spw_backend_brick_init(&link, 0 /* device index */, 1 /* channel */);
#endif

spw_link_up(&link);
/* All further code is identical regardless of backend */
```

---

## FPGA Backend Skeleton (`spw_backend_fpga.c`)

```c
#include "spw_hal.h"
#include <sys/socket.h>
#include <net/if.h>
#include <linux/spw.h>
#include <unistd.h>
#include <string.h>
#include <stdlib.h>

typedef struct {
    int   fd;
    char  ifname[IFNAMSIZ];
    int   protocol;
} fpga_priv_t;

static spw_err_t fpga_open(spw_link_t *link, const char *name, int protocol)
{
    fpga_priv_t *p = calloc(1, sizeof(*p));
    if (!p) return SPW_ERR_NOMEM;

    strncpy(p->ifname, name, IFNAMSIZ - 1);
    p->protocol = protocol;

    p->fd = socket(PF_SPW, SOCK_RAW, protocol);
    if (p->fd < 0) { free(p); return SPW_ERR_GENERAL; }

    struct ifreq ifr;
    strncpy(ifr.ifr_name, name, IFNAMSIZ - 1);
    if (setsockopt(p->fd, SOL_SOCKET, SO_BINDTODEVICE,
                   ifr.ifr_name, strlen(ifr.ifr_name)) < 0) {
        close(p->fd); free(p); return SPW_ERR_GENERAL;
    }

    link->priv = p;
    return SPW_OK;
}

static void fpga_close(spw_link_t *link)
{
    fpga_priv_t *p = link->priv;
    if (p) { close(p->fd); free(p); link->priv = NULL; }
}

static spw_err_t fpga_link_up(spw_link_t *link)
{
    fpga_priv_t *p = link->priv;
    char cmd[64];
    snprintf(cmd, sizeof(cmd), "ip link set %s up", p->ifname);
    return (system(cmd) == 0) ? SPW_OK : SPW_ERR_LINK;
    /* TODO: replace system() with netlink/libmnl calls for production */
}

static spw_err_t fpga_link_down(spw_link_t *link)
{
    fpga_priv_t *p = link->priv;
    char cmd[64];
    snprintf(cmd, sizeof(cmd), "ip link set %s down", p->ifname);
    return (system(cmd) == 0) ? SPW_OK : SPW_ERR_LINK;
}

static spw_err_t fpga_set_clk_rate(spw_link_t *link, uint32_t hz)
{
    fpga_priv_t *p = link->priv;
    /* Must be called while link is DOWN */
    char cmd[128];
    snprintf(cmd, sizeof(cmd),
             "ip link set %s type spw clk-rate %u", p->ifname, hz);
    return (system(cmd) == 0) ? SPW_OK : SPW_ERR_GENERAL;
}

static spw_err_t fpga_send(spw_link_t *link, const void *buf,
                             size_t len, int send_eep)
{
    fpga_priv_t *p = link->priv;
    ssize_t ret;

    if (send_eep) {
        /* Build sendmsg with SPW_CMSG_EEP control message */
        struct msghdr msg = {0};
        struct iovec iov  = { .iov_base = (void *)buf, .iov_len = len };
        char cmsgbuf[CMSG_SPACE(sizeof(int))];
        msg.msg_iov        = &iov;
        msg.msg_iovlen     = 1;
        msg.msg_control    = cmsgbuf;
        msg.msg_controllen = sizeof(cmsgbuf);
        struct cmsghdr *cm = CMSG_FIRSTHDR(&msg);
        cm->cmsg_level = SOL_SPW;
        cm->cmsg_type  = SPW_CMSG_EEP;
        cm->cmsg_len   = CMSG_LEN(sizeof(int));
        *((int *)CMSG_DATA(cm)) = 1;
        ret = sendmsg(p->fd, &msg, 0);
    } else {
        ret = send(p->fd, buf, len, 0);
    }

    if (ret < 0) return SPW_ERR_GENERAL;
    return SPW_OK;
}

static spw_err_t fpga_recv(spw_link_t *link, void *buf, size_t buflen,
                             size_t *out_len, int *out_eep, int timeout_ms)
{
    fpga_priv_t *p = link->priv;

    if (timeout_ms >= 0) {
        struct timeval tv = {
            .tv_sec  = timeout_ms / 1000,
            .tv_usec = (timeout_ms % 1000) * 1000
        };
        setsockopt(p->fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
    }

    struct msghdr msg = {0};
    struct iovec iov  = { .iov_base = buf, .iov_len = buflen };
    char cmsgbuf[CMSG_SPACE(sizeof(int))];
    msg.msg_iov        = &iov;
    msg.msg_iovlen     = 1;
    msg.msg_control    = cmsgbuf;
    msg.msg_controllen = sizeof(cmsgbuf);

    ssize_t ret = recvmsg(p->fd, &msg, 0);
    if (ret < 0) return (errno == EAGAIN) ? SPW_ERR_TIMEOUT : SPW_ERR_GENERAL;

    *out_len = (size_t)ret;
    *out_eep = 0;

    for (struct cmsghdr *cm = CMSG_FIRSTHDR(&msg); cm;
         cm = CMSG_NXTHDR(&msg, cm)) {
        if (cm->cmsg_type == SPW_CMSG_EEP)
            *out_eep = *((int *)CMSG_DATA(cm));
    }

    if (msg.msg_flags & MSG_TRUNC) return SPW_ERR_TRUNC;
    return SPW_OK;
}

static spw_err_t fpga_send_timecode(spw_link_t *link, uint8_t value)
{
    fpga_priv_t *p = link->priv;
    int s = socket(PF_SPW, SOCK_RAW, SPW_RAW);
    if (s < 0) return SPW_ERR_GENERAL;
    struct ifreq ifr;
    strncpy(ifr.ifr_name, p->ifname, IFNAMSIZ - 1);
    *((uint8_t *)&ifr.ifr_ifru) = value;
    int r = ioctl(s, SIOCSTIMETX, &ifr);
    close(s);
    return (r == 0) ? SPW_OK : SPW_ERR_GENERAL;
}

static const spw_backend_ops_t fpga_ops = {
    .open                = fpga_open,
    .close               = fpga_close,
    .link_up             = fpga_link_up,
    .link_down           = fpga_link_down,
    .set_clk_rate        = fpga_set_clk_rate,
    .send                = fpga_send,
    .recv                = fpga_recv,
    .send_timecode       = fpga_send_timecode,
    .register_timecode_rx = NULL,  /* TODO: implement signal-based registration */
    .get_stats           = NULL,   /* TODO: implement sysfs stat reads */
};

spw_err_t spw_backend_fpga_init(spw_link_t *link,
                                  const char *ifname, int protocol)
{
    link->ops = &fpga_ops;
    return fpga_open(link, ifname, protocol);
}
```

---

## USB Brick Backend Skeleton (`spw_backend_brick.c`)

```c
#include "spw_hal.h"
#include <star-api.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    STAR_DEVICE_ID   deviceId;
    STAR_CHANNEL_ID  channelId;
    unsigned char    channelNumber;
} brick_priv_t;

static spw_err_t brick_open(spw_link_t *link, const char *name, int protocol)
{
    /* name = device index as string, e.g. "0" */
    brick_priv_t *p = calloc(1, sizeof(*p));
    if (!p) return SPW_ERR_NOMEM;

    U32 deviceCount;
    STAR_DEVICE_ID *devList = STAR_getDeviceList(&deviceCount);
    if (!devList || deviceCount == 0) { free(p); return SPW_ERR_GENERAL; }

    int idx = atoi(name);
    if (idx >= (int)deviceCount) {
        STAR_destroyDeviceList(devList); free(p); return SPW_ERR_GENERAL;
    }
    p->deviceId = devList[idx];
    STAR_destroyDeviceList(devList);
    p->channelNumber = 1;  /* Always channel 1 for data on Brick */

    STAR_CHANNEL_MASK mask = STAR_getDeviceChannels(p->deviceId);
    if (!(mask & (1 << p->channelNumber))) { free(p); return SPW_ERR_GENERAL; }

    p->channelId = STAR_openChannelToLocalDevice(
        p->deviceId, STAR_CHANNEL_DIRECTION_INOUT, p->channelNumber, 1);
    if (!p->channelId) { free(p); return SPW_ERR_GENERAL; }

    link->priv = p;
    return SPW_OK;
}

static void brick_close(spw_link_t *link)
{
    brick_priv_t *p = link->priv;
    if (p) {
        if (p->channelId) STAR_closeChannel(p->channelId);
        free(p);
        link->priv = NULL;
    }
}

/* link_up / link_down: on Brick, the link is managed by the device itself.
   These are no-ops unless you want to use Device Configuration APIs to
   reset or reconfigure the link. */
static spw_err_t brick_link_up(spw_link_t *link)   { return SPW_OK; }
static spw_err_t brick_link_down(spw_link_t *link) { return SPW_OK; }

static spw_err_t brick_send(spw_link_t *link, const void *buf,
                              size_t len, int send_eep)
{
    brick_priv_t *p = link->priv;
    STAR_EOP_TYPE eop = send_eep ? STAR_EOP_TYPE_EEP : STAR_EOP_TYPE_EOP;
    STAR_TRANSFER_STATUS status =
        STAR_transmitPacket(p->channelId, (void *)buf, (U32)len, eop, -1);
    return (status == STAR_TRANSFER_STATUS_COMPLETE) ? SPW_OK : SPW_ERR_GENERAL;
}

static spw_err_t brick_recv(spw_link_t *link, void *buf, size_t buflen,
                              size_t *out_len, int *out_eep, int timeout_ms)
{
    brick_priv_t *p = link->priv;
    unsigned int rxLen = (unsigned int)buflen;
    STAR_EOP_TYPE eopType;

    STAR_TRANSFER_STATUS status =
        STAR_receivePacket(p->channelId, buf, &rxLen, &eopType, timeout_ms);

    if (status == STAR_TRANSFER_STATUS_COMPLETE) {
        *out_len = rxLen;
        *out_eep = (eopType == STAR_EOP_TYPE_EEP) ? 1 : 0;
        return SPW_OK;
    } else if (status == STAR_TRANSFER_STATUS_TIMEDOUT) {
        return SPW_ERR_TIMEOUT;
    }
    return SPW_ERR_GENERAL;
}

static const spw_backend_ops_t brick_ops = {
    .open             = brick_open,
    .close            = brick_close,
    .link_up          = brick_link_up,
    .link_down        = brick_link_down,
    .set_clk_rate     = NULL,          /* TODO: use Device Configuration API */
    .send             = brick_send,
    .recv             = brick_recv,
    .send_timecode    = NULL,          /* TODO: STAR timecode API */
    .register_timecode_rx = NULL,      /* TODO: STAR timecode callback */
    .get_stats        = NULL,
};

spw_err_t spw_backend_brick_init(spw_link_t *link, int device_index,
                                   unsigned char channel_number)
{
    link->ops = &brick_ops;
    char name[8];
    snprintf(name, sizeof(name), "%d", device_index);
    return brick_open(link, name, 0 /* protocol unused by STAR-API */);
}
```

---

## Error Recovery (HAL Level)

```c
spw_err_t spw_recover(spw_link_t *link)
{
    spw_link_down(link);
    usleep(50000);   /* 50 ms */
    return spw_link_up(link);
}
```

Call `spw_recover()` when `spw_send()` or `spw_recv()` returns `SPW_ERR_LINK` or when
monitoring detects a disconnect error in `REG_STATUS`.

---

## File Layout

```
src/
├── spw_hal.h                  # Interface definition (shared header)
├── spw_backend_fpga.c         # FPGA/socket backend
├── spw_backend_brick.c        # STAR-API/USB Brick backend
└── spw_rmap.c                 # RMAP initiator/target built on HAL
```