# RMAP Protocol Reference

Source: ECSS-E-ST-50-52C (Remote Memory Access Protocol)
RMAP is implemented in **user space** as a library on top of the SpaceWire socket layer.
The FPGA IP core and Linux driver handle it as raw bytes — RMAP framing is the application's
responsibility. On STAR-API, the RMAP Library (part of STAR-System) can optionally be used.

Protocol identifier: **1** (use `SPW_RMAP` socket type to filter RMAP-only packets).

---

## RMAP Roles

| Role | Description |
|------|-------------|
| **Initiator** | Sends commands (read/write requests). Your flight software is typically the initiator. |
| **Target** | Receives commands and executes memory operations. Responds with reply packets. |

---

## Packet Structure

### Common Header Fields (all RMAP packets)

```
Byte 0:       Target Logical Address   (destination address on the SpW network)
Byte 1:       Protocol Identifier      (always 0x01 for RMAP)
Byte 2:       Packet Type + Instruction
              [7]   = 1 (command) or 0 (reply)
              [6:5] = Command code (00=invalid, 01=read, 10=write no verify no reply,
                                    11=write verify reply)
              [4]   = Reply bit (1 = initiator requests a reply)
              [3]   = Increment bit (1 = auto-increment address)
              [2:0] = Reserved / reply address length
Byte 3:       Key                      (security key — must match target's config)
Byte 4–N:     Reply Address            (path address back to initiator — 0 bytes if point-to-point)
Byte N+1:     Initiator Logical Address
Byte N+2–3:   Transaction Identifier   (16-bit, echoed in reply for correlation)
Byte N+4:     Extended Memory Address  (upper 8 bits of 40-bit address, often 0x00)
Byte N+5–8:   Memory Address           (32-bit target memory address, big-endian)
Byte N+9–11:  Data Length              (24-bit, big-endian — number of bytes to read/write)
Byte N+12:    Header CRC               (RMAP CRC-8 over all header bytes)
```

For **write commands**, data bytes follow the header CRC:
```
Data bytes (Data Length bytes)
Data CRC (1 byte — RMAP CRC-8 over data bytes only)
EOP
```

---

## RMAP CRC-8

RMAP uses a specific CRC-8 polynomial. Reference implementation:

```c
static const uint8_t rmap_crc_table[256] = {
    0x00, 0x91, 0xe3, 0x72, 0x07, 0x96, 0xe4, 0x75,
    0x0e, 0x9f, 0xed, 0x7c, 0x09, 0x98, 0xea, 0x7b,
    /* ... full 256-entry table from ECSS-E-ST-50-52C Annex B ... */
};

uint8_t rmap_crc(const uint8_t *data, size_t len)
{
    uint8_t crc = 0x00;
    for (size_t i = 0; i < len; i++) {
        crc = rmap_crc_table[crc ^ data[i]];
    }
    return crc;
}
```

> **Note**: Always compute header CRC and data CRC separately. The header CRC covers all
> bytes from the target logical address up to (not including) the header CRC byte. The data
> CRC covers all data bytes only.

---

## Write Command (with reply)

```c
int rmap_build_write_cmd(uint8_t *buf, size_t bufsize,
                          uint8_t target_addr,
                          uint8_t initiator_addr,
                          uint8_t key,
                          uint16_t transaction_id,
                          uint32_t mem_addr,
                          const uint8_t *data,
                          uint32_t data_len)
{
    int idx = 0;

    /* Header */
    buf[idx++] = target_addr;          /* Target Logical Address */
    buf[idx++] = 0x01;                 /* RMAP Protocol ID */
    buf[idx++] = 0x6C;                 /* Command: write, verify, reply, increment */
                                       /* Bits: 1 (cmd) 10 (write) 1 (reply) 1 (incr) 00 (no path) */
    buf[idx++] = key;
    /* Reply address: 0 bytes (point-to-point, no routing path) */
    buf[idx++] = initiator_addr;
    buf[idx++] = (transaction_id >> 8) & 0xFF;
    buf[idx++] = transaction_id & 0xFF;
    buf[idx++] = 0x00;                 /* Extended address = 0 */
    buf[idx++] = (mem_addr >> 24) & 0xFF;
    buf[idx++] = (mem_addr >> 16) & 0xFF;
    buf[idx++] = (mem_addr >> 8)  & 0xFF;
    buf[idx++] = mem_addr & 0xFF;
    buf[idx++] = (data_len >> 16) & 0xFF;
    buf[idx++] = (data_len >> 8)  & 0xFF;
    buf[idx++] = data_len & 0xFF;
    buf[idx++] = rmap_crc(buf, idx);   /* Header CRC */

    /* Data */
    memcpy(&buf[idx], data, data_len);
    idx += data_len;
    buf[idx++] = rmap_crc(data, data_len);  /* Data CRC */

    return idx;  /* total bytes to send */
}
```

---

## Read Command

```c
int rmap_build_read_cmd(uint8_t *buf, size_t bufsize,
                         uint8_t target_addr,
                         uint8_t initiator_addr,
                         uint8_t key,
                         uint16_t transaction_id,
                         uint32_t mem_addr,
                         uint32_t read_len)
{
    int idx = 0;

    buf[idx++] = target_addr;
    buf[idx++] = 0x01;
    buf[idx++] = 0x4C;    /* Command: read, reply, increment, no verify */
                          /* Bits: 1 (cmd) 01 (read) 1 (reply) 1 (incr) 00 */
    buf[idx++] = key;
    buf[idx++] = initiator_addr;
    buf[idx++] = (transaction_id >> 8) & 0xFF;
    buf[idx++] = transaction_id & 0xFF;
    buf[idx++] = 0x00;    /* Extended address */
    buf[idx++] = (mem_addr >> 24) & 0xFF;
    buf[idx++] = (mem_addr >> 16) & 0xFF;
    buf[idx++] = (mem_addr >> 8)  & 0xFF;
    buf[idx++] = mem_addr & 0xFF;
    buf[idx++] = (read_len >> 16) & 0xFF;
    buf[idx++] = (read_len >> 8)  & 0xFF;
    buf[idx++] = read_len & 0xFF;
    buf[idx++] = rmap_crc(buf, idx);  /* Header CRC (no data CRC for read commands) */

    return idx;
}
```

---

## Reply Packet Structure

### Write Reply

```
Byte 0:   Initiator Logical Address
Byte 1:   0x01 (RMAP protocol)
Byte 2:   Instruction (echo of command instruction, reply bit cleared)
Byte 3:   Status (0x00 = success — see status table below)
Byte 4:   Target Logical Address (echo)
Byte 5–6: Transaction ID (echo)
Byte 7:   Header CRC
EOP
```

### Read Reply

```
Byte 0:   Initiator Logical Address
Byte 1:   0x01
Byte 2:   Instruction
Byte 3:   Status
Byte 4:   Target Logical Address
Byte 5–6: Transaction ID
Byte 7:   Reserved (0x00)
Byte 8–10: Data Length (echo of requested length on success)
Byte 11:  Header CRC
Data bytes (Data Length bytes)
Data CRC
EOP
```

---

## RMAP Status Codes

| Code | Meaning |
|------|---------|
| 0x00 | Success |
| 0x01 | General error code |
| 0x02 | Unused RMAP packet type or command code |
| 0x03 | Invalid key |
| 0x04 | Invalid data CRC |
| 0x05 | Early EOP |
| 0x06 | Too much data |
| 0x07 | EEP |
| 0x09 | Verify buffer overrun |
| 0x0A | RMAP command not implemented or not authorised |
| 0x0B | RMW data length error |
| 0x0C | Invalid target logical address |

---

## RMAP Transaction Pattern (Initiator)

```c
/* Pseudo-code for a complete RMAP write-with-reply transaction */

uint8_t cmd_buf[512];
uint8_t reply_buf[64];
uint16_t tid = get_next_transaction_id();

/* 1. Build command */
int cmd_len = rmap_build_write_cmd(cmd_buf, sizeof(cmd_buf),
    TARGET_ADDR, INITIATOR_ADDR, RMAP_KEY,
    tid, TARGET_MEM_ADDR, data, data_len);

/* 2. Send over SpaceWire (SPW_RMAP socket or raw socket) */
int fd = open_spw_socket("spw0", SPW_RMAP);
send(fd, cmd_buf, cmd_len, 0);

/* 3. Receive reply (with timeout) */
struct timeval tv = { .tv_sec = 1, .tv_usec = 0 };
setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
ssize_t reply_len = recv(fd, reply_buf, sizeof(reply_buf), 0);

/* 4. Parse reply */
if (reply_len < 8) { /* error */ }
uint8_t status = reply_buf[3];
uint16_t rx_tid = ((uint16_t)reply_buf[5] << 8) | reply_buf[6];

if (status != 0x00) { /* RMAP error — check status table */ }
if (rx_tid != tid)   { /* Transaction ID mismatch */ }
```

---

## Using SPW_RMAP Socket vs SPW_RAW

| Socket type | Behaviour |
|-------------|-----------|
| `SPW_RMAP` | Receives only packets where protocol byte == 0x01. Driver filters for you. |
| `SPW_RAW` | Receives all SpaceWire packets regardless of protocol byte. Your code must filter. |

For a dedicated RMAP initiator or target thread, use `SPW_RMAP` to avoid receiving CCSDS or
NATIVE packets on the same socket.

---

## STAR-System RMAP Library

When using the STAR-API backend (USB Brick), STAR-System includes an RMAP Packet Library.
Refer to the STAR-Dundee application note "Implementing A Simple RMAP Initiator Using The
STAR-System APIs" for full usage. The library constructs and parses RMAP packets and can be
combined with the channel/transfer-operation API shown in `references/star-api.md`.