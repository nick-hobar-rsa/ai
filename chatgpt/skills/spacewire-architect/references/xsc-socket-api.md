# XSC SpaceWire Socket API Reference (FPGA / Flight System)

Source: XSC-1542-6028-c SpaceWire API, SpaceWireAPI.md
The XSC implementation exposes SpaceWire as Linux network interfaces (e.g. `spw0`, `spw1`).
The API is modelled on the Berkeley socket API — familiar to anyone who has written TCP/IP code.

---

## Protocol Stack Overview

```
User Application
     │
     ├── RMAP Library        (user-space, protocol id 1)
     ├── CCSDS Library       (user-space, protocol id 2)
     │
Linux Kernel (AF_SPW socket layer)
     │
SpaceWire Driver (xsc-spacewire-main.c)
     │
XSC FPGA IP Core (physical + link + exchange levels)
     │
Hardware (LVDS, cables, connectors)
```

SpaceWire network addressing is **not** supported — all links are point-to-point.
Reliable transport and CCSDS Space Packet handling are **not** provided by the driver — the
user application is responsible for these.

---

## Socket Types

| Protocol constant | `socket()` call | Receives |
|-------------------|----------------|----------|
| `SPW_RAW` | `socket(PF_SPW, SOCK_RAW, SPW_RAW)` | All SpaceWire packets |
| `SPW_RMAP` | `socket(PF_SPW, SOCK_RAW, SPW_RMAP)` | Only RMAP packets (protocol id 1) |
| `SPW_CCSDS` | `socket(PF_SPW, SOCK_RAW, SPW_CCSDS)` | Only CCSDS packets (protocol id 2) |
| `SPW_NATIVE` | `socket(PF_SPW, SOCK_RAW, SPW_NATIVE)` | Only NATIVE packets (protocol id 240) |

Socket family is `AF_SPW` (not `AF_INET`). No MAC address or IP address is needed — the
interface number (e.g. `spw0`) is the only routing identifier.

---

## Link Control

### Bring a link up or down

```bash
ip link set spw0 up
ip link set spw0 down
```

### Check link state and statistics

```bash
ip -s link show spw0
```

### Set link clock rate (must be done while link is DOWN)

```bash
ip link set spw0 down
ip link set spw0 type spw clk-rate 50000000   # 50 MHz
ip link set spw0 up
```

Setting `clk-rate` automatically activates high-speed mode. To enable high-speed with
auto-negotiated rate:

```bash
ip link set spw0 type spw high-speed on
ip link set spw0 up
```

> **Warning**: The interface must be DOWN before reconfiguring clock rate. Always bring it
> down first, configure, then bring up.

### Manage link from C using libmnl

See `test/spw-link.c` in the XSC source tree for examples using `libmnl` to get and set
link state programmatically from C code.

---

## Opening a Socket (C)

```c
#include <sys/socket.h>
#include <net/if.h>
/* XSC SpaceWire headers — include path set by Yocto layer */
#include <linux/spw.h>   /* AF_SPW, PF_SPW, SPW_RAW, SPW_RMAP, etc. */

int spw_open_socket(const char *ifname, int protocol)
{
    int fd = socket(PF_SPW, SOCK_RAW, protocol);
    if (fd < 0) {
        perror("socket");
        return -1;
    }

    /* Bind to specific interface */
    struct ifreq ifr;
    memset(&ifr, 0, sizeof(ifr));
    strncpy(ifr.ifr_name, ifname, IFNAMSIZ - 1);

    if (setsockopt(fd, SOL_SOCKET, SO_BINDTODEVICE,
                   ifr.ifr_name, strlen(ifr.ifr_name)) < 0) {
        perror("setsockopt SO_BINDTODEVICE");
        close(fd);
        return -1;
    }

    return fd;
}
```

---

## Sending Packets

### Simple send (EOP by default)

```c
ssize_t spw_send(int fd, const void *buf, size_t len)
{
    ssize_t ret = send(fd, buf, len, 0);
    if (ret < 0) {
        perror("send");
    }
    return ret;
}
```

### Sending with EEP (error end of packet)

Use `sendmsg()` with a control message of type `SPW_CMSG_EEP`:

```c
ssize_t spw_send_eep(int fd, const void *buf, size_t len)
{
    struct msghdr msg = {0};
    struct iovec iov = { .iov_base = (void *)buf, .iov_len = len };

    char cmsgbuf[CMSG_SPACE(sizeof(int))];
    struct cmsghdr *cmsg;

    msg.msg_iov    = &iov;
    msg.msg_iovlen = 1;
    msg.msg_control    = cmsgbuf;
    msg.msg_controllen = sizeof(cmsgbuf);

    cmsg = CMSG_FIRSTHDR(&msg);
    cmsg->cmsg_level = SOL_SPW;
    cmsg->cmsg_type  = SPW_CMSG_EEP;
    cmsg->cmsg_len   = CMSG_LEN(sizeof(int));
    *((int *)CMSG_DATA(cmsg)) = 1;

    return sendmsg(fd, &msg, 0);
}
```

---

## Receiving Packets

### Simple receive

```c
ssize_t spw_recv(int fd, void *buf, size_t buflen)
{
    ssize_t ret = recv(fd, buf, buflen, 0);
    if (ret < 0) {
        perror("recv");
    }
    return ret;
    /* EOP is the default — not signalled to application */
    /* If MSG_TRUNC is set, packet was larger than buflen and was truncated */
}
```

### Receiving and detecting EEP

Use `recvmsg()` and inspect the control message for `SPW_CMSG_EEP`:

```c
int spw_recv_with_eep(int fd, void *buf, size_t buflen,
                      ssize_t *out_len, int *out_eep)
{
    struct msghdr msg = {0};
    struct iovec iov = { .iov_base = buf, .iov_len = buflen };
    char cmsgbuf[CMSG_SPACE(sizeof(int))];

    msg.msg_iov        = &iov;
    msg.msg_iovlen     = 1;
    msg.msg_control    = cmsgbuf;
    msg.msg_controllen = sizeof(cmsgbuf);

    *out_len = recvmsg(fd, &msg, 0);
    if (*out_len < 0) {
        perror("recvmsg");
        return -1;
    }

    *out_eep = 0;
    for (struct cmsghdr *cm = CMSG_FIRSTHDR(&msg); cm;
         cm = CMSG_NXTHDR(&msg, cm)) {
        if (cm->cmsg_type == SPW_CMSG_EEP) {
            *out_eep = *((int *)CMSG_DATA(cm));
        }
    }

    return 0;
}
```

> **EOP** packets are received normally — the EOP marker is not passed to the application.
> **EEP** packets are flagged via `msg_control`. Always check for EEP in flight code.
> **MSG_TRUNC**: Implemented per `recv(2)` — if the received packet is larger than the buffer,
> the excess is dropped and `MSG_TRUNC` is set in `msg_flags`.

---

## Timecodes

### Send a timecode

```c
void spw_send_timecode(const char *ifname, uint8_t timecode_value)
{
    int s = socket(PF_SPW, SOCK_RAW, SPW_RAW);
    if (s < 0) { perror("socket"); return; }

    struct ifreq ifr;
    *((uint8_t *)&ifr.ifr_ifru) = timecode_value;
    strncpy(ifr.ifr_name, ifname, IFNAMSIZ - 1);

    if (ioctl(s, SIOCSTIMETX, &ifr) < 0) {
        perror("ioctl SIOCSTIMETX");
    }
    close(s);
}
```

Timecodes are higher priority than data packets — they are guaranteed to be sent between
packets as long as the link is up.

### Register to receive timecodes (signal-based)

```c
#include <signal.h>

static void timecode_handler(int sig, siginfo_t *info, void *ctx)
{
    /* info->si_value carries the timecode value (implementation-defined) */
    printf("Timecode received\n");
}

void spw_register_timecode_rx(const char *ifname)
{
    int s = socket(PF_SPW, SOCK_RAW, SPW_RAW);
    struct ifreq ifr;
    pid_t pid = getpid();

    strncpy(ifr.ifr_name, ifname, IFNAMSIZ - 1);
    *((pid_t *)&ifr.ifr_ifru) = pid;

    ioctl(s, SIOCSTIMEREG, &ifr);
    close(s);  /* Socket can be closed after registration */

    struct sigaction sa;
    sa.sa_sigaction = timecode_handler;
    sa.sa_flags     = SA_SIGINFO;
    sigemptyset(&sa.sa_mask);
    sigaction(SIG_TIME_CODE, &sa, NULL);
}
```

---

## Link Statistics

Available in sysfs — no ioctl required:

```bash
cat /sys/class/net/spw0/statistics/rx_bytes
cat /sys/class/net/spw0/statistics/rx_packets
cat /sys/class/net/spw0/statistics/tx_bytes
cat /sys/class/net/spw0/statistics/tx_packets
```

From C:

```c
long spw_read_stat(const char *ifname, const char *stat)
{
    char path[256];
    snprintf(path, sizeof(path),
             "/sys/class/net/%s/statistics/%s", ifname, stat);
    FILE *f = fopen(path, "r");
    if (!f) return -1;
    long val;
    fscanf(f, "%ld", &val);
    fclose(f);
    return val;
}
```

---

## Link Error Codes

Errors are logged to the kernel ring buffer (`dmesg`). The driver maps hardware status bits
to these human-readable messages:

| Status Bit Constant | Error Message |
|---------------------|---------------|
| `XSCSPW_REG_STATUS_GOTTIMECHARERR` | Got Time Char but not in running mode |
| `XSCSPW_REG_STATUS_GOTNCHARERR` | Got NCHAR but not in running mode |
| `XSCSPW_REG_STATUS_RUNCREDITERRTX` | Credit Error TX while running |
| `XSCSPW_REG_STATUS_RUNCREDITERRRX` | Credit Error RX while running |
| `XSCSPW_REG_STATUS_RUNESCERR` | ESC Error while running |
| `XSCSPW_REG_STATUS_RUNPARITYERR` | Parity Error while running |
| `XSCSPW_REG_STATUS_RUNDISCERR` | Disconnect Error while running |
| `XSCSPW_REG_STATUS_CREDITERRTX` | Credit Error TX while NOT running |
| `XSCSPW_REG_STATUS_CREDITERRRX` | Credit Error RX while NOT running |
| `XSCSPW_REG_STATUS_ESCERR` | ESC Error while NOT running |
| `XSCSPW_REG_STATUS_PARITYERR` | Parity Error while NOT running |
| `XSCSPW_REG_STATUS_DISCERR` | Disconnect Error while NOT running |

### Error recovery pattern

```c
void spw_recover_link(const char *ifname)
{
    /* Bring link down */
    system_cmd("ip link set %s down", ifname);

    /* Wait for link error recovery timer (ECSS mandates 6.4 µs minimum in error wait) */
    usleep(10000);  /* 10 ms — conservative, safe for embedded use */

    /* Bring back up */
    system_cmd("ip link set %s up", ifname);
}
```

See `references/protocol.md` for the full SpaceWire link state machine.

---

## Interface Naming Convention

Interfaces are named `spw0`, `spw1`, etc. The mapping between interface index and physical
SpaceWire port is determined by the FPGA configuration and Yocto device tree. Confirm the
mapping in your platform's device tree / BSP.

---

## Example: spw-test CLI Tool

The XSC tree includes `test/spw-test.c`. Usage:

```bash
spw-test --help
spw-test -i spw0 -n 1000       # receive 1000 packets on spw0
spw-test -i spw1 -n 1000 --tx  # transmit 1000 packets on spw1
```

This is the reference implementation — read it when you need to understand EOP/EEP message
control ancillary data patterns in full detail.