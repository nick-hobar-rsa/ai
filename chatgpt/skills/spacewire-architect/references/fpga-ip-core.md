# XSC SpaceWire FPGA IP Core Reference

Source: xsc_q7_zynq_spw_native.md
The XSC SpaceWire Native Interface IP core implements ECSS-E-ST-50-12C at the physical,
signal, character, exchange, and packet levels in FPGA logic. The Linux driver interacts
with this core through AXI4-Lite registers, DMA, and command/status FIFOs.

---

## Architecture Summary

```
User Space
    │  AF_SPW sockets (sendmsg / recvmsg)
Kernel Driver (xsc-spacewire-main.c)
    │  AXI4-Lite register reads/writes
    │  AXI DMA (MM2S for TX, S2MM for RX)
FPGA Logic
    ├── Link Controller    (ECSS link state machine)
    ├── Transmitter        (DS encoding, flow control)
    ├── Receiver           (oversampled edge detection)
    ├── Register Interface (AXI4-Lite slave)
    ├── Command FIFO       (up to 16 TX requests queued)
    ├── Status FIFO        (up to 16 RX packet statuses)
    ├── Stream FIFOs       (2x 2048×32, i.e. 8 kB each for TX/RX buffering)
    └── AXI_DMA            (Xilinx DMA — moves data between RAM and FIFOs)
Hardware
    └── SpaceWire port (i_din, i_sin, o_dout, o_sout — LVDS)
```

One IP core instance = one SpaceWire link. 8 links = 8 instances.

---

## Key Difference vs Standard SpaceWire

The XSC IP core does **not** implement clock recovery. Instead, the data and strobe signals
are **oversampled** (2× FPGA master clock via PLL) to detect transitions. This means:
- No PLL lock required on the received signal
- Suitable for lower data-rate applications
- Baud rate output is FPGA clock / 25 (by default)

---

## Register Map

Base address is assigned in the Zynq device tree. All registers are 32-bit, AXI4-Lite.

### REG_CTRL (0x00) — R/W, default 0x00000400

| Bits | Field | Description |
|------|-------|-------------|
| 31:12 | Reserved | — |
| 11 | LOGIC_EN | 1 = Enable logic, 0 = Reset logic |
| 10 | LINK_DISABLE | 1 = Disable SpaceWire link |
| 9 | AUTOSTART | 1 = Enable autostart (link starts automatically) |
| 8 | MANUAL_START | 1 = Enable link manually |
| 7:1 | Reserved | — |
| 0 | CLK_SEL | 0 = 10 MHz base, 1 = PLL selected |

> **Bits 8–10 are mutually exclusive.** Only one of LINK_DISABLE, AUTOSTART, or MANUAL_START
> may be set at a time.

### REG_STATUS (0x04) — R, default 0x00000000

| Bits | Field | Description |
|------|-------|-------------|
| 31 | TX_INTR | TX interrupt pending |
| 30 | RX_INTR | RX interrupt pending |
| 28 | TIME_TOKEN_RX | Time token received |
| 13 | CREDIT_AVAIL | Credit available for transmission (level) |
| 12 | RUN_ACTIVE | Run mode active (level) |
| 11 | GOTTIMECHARERR | Time char received while not in run mode |
| 10 | GOTNCHARERR | NCHAR received while not in run mode |
| 9 | RUNCREDITERRTX | Credit error TX in run mode |
| 8 | RUNCREDITERRRX | Credit error RX in run mode |
| 7 | RUNESCERR | ESC error in run mode |
| 6 | RUNPARITYERR | Parity error in run mode |
| 5 | RUNDISCERR | Disconnect error in run mode |
| 4 | CREDITERRTX | Credit error TX (not running) |
| 3 | CREDITERRRX | Credit error RX (not running) |
| 2 | ESCERR | ESC error (not running) |
| 1 | PARITYERR | Parity error (not running) |
| 0 | DISCERR | Disconnect error (not running) |

### REG_STATUS_CLR (0x08) — W

Write a 1 to any bit to clear the corresponding status bit.

### REG_INTR_EN (0x0C) — R/W

Each bit enables/disables interrupt generation for the corresponding REG_STATUS bit.

### REG_TIME_FROM_LINK (0x10) — R

Bits 7:0 = last received time token value.

### REG_TIME_TO_LINK (0x14) — W

Write bits 7:0 with the time token value to send. Sending is immediate upon write.
Time tokens are higher priority than data — guaranteed to be sent if the link is up.

### REG_LINK_CTRL_STATE (0x18) — R

| Bits | Description |
|------|-------------|
| 6:4 | Link controller state (see below) |
| 3 | Run mode active |
| 2 | First time char received |
| 1 | First NCHAR received |
| 0 | First NULL received |

**Link controller states (bits 6:4):**

| Value | State |
|-------|-------|
| 0 | Error Reset |
| 1 | Error Wait |
| 2 | Ready |
| 3 | Started |
| 5 | Connecting |
| 6 | Run |

### REG_INR_USEC_CNTR (0x1C) — R

Bits 23:0 = microseconds since last interrupt. Auto-cleared when interrupt is cleared.

### REG_RX_STATUS (0x20) — R

| Bits | Description |
|------|-------------|
| 19:16 | Last read RX command register index |
| 15:0 | "Done" bits for all 16 RX command registers |

### REG_TX_STATUS (0x24) — R

| Bits | Description |
|------|-------------|
| 19:16 | Last write TX command register index |
| 15:0 | "Done" bits for all 16 TX command registers |

### REG_IDENTIFICATION (0x84) — R

Unique IP core identifier (read to confirm correct base address mapping).

### REG_VERSION (0x80) — R

Core revision number (currently version 2).

---

## TX/RX Command Registers (16 each)

### REG_TX_CMD (16 registers, base 0x20XX) — R/W

| Bits | Field | Description |
|------|-------|-------------|
| 19 | DONE | Set by logic when transmission complete |
| 18 | READY | Set by CPU to trigger transmission |
| 17 | MULTI | 1 = multi-slot packet (packet spans multiple slots) |
| 16 | SEND_EEP | 1 = append EEP instead of EOP |
| 8:0 | SIZE | Packet size in bytes (1–256; 0 is invalid) |

### REG_RX_CMD (16 registers, base 0x10XX) — R/W

| Bits | Field | Description |
|------|-------|-------------|
| 19 | DONE | Set by logic when reception complete |
| 18 | READY | Set by CPU to mark slot as available |
| 17 | MULTI | 1 = multi-slot packet |
| 16 | EEP_RX | 1 = EEP was received (not EOP) |
| 8:0 | SIZE | Received packet size (0 = bad/zero-length packet) |

---

## TX/RX Data Buffers

| Register group | Address | Description |
|----------------|---------|-------------|
| REG_TX_DATA (16 × 256 B) | 0x8XXX | 16 transmit data slots of 256 bytes each |
| REG_RX_DATA (16 × 256 B) | 0x4XXX | 16 receive data slots of 256 bytes each |

Each slot = 256 bytes = one packet slot. Large packets span multiple consecutive slots
(MULTI bit set). Maximum packet size in current logic: 256 bytes per slot.

---

## TX Operation Flow (CPU perspective)

```
1. Write packet data to REG_TX_DATA[slot]
2. Write REG_TX_CMD[slot]:
     - Set SIZE = number of bytes
     - Set SEND_EEP = 1 if EEP desired
     - Set MULTI = 1 if packet spans multiple slots
     - Set READY = 1  ← triggers transmission
3. Continue filling more slots if needed (up to 16 queued)
4. Wait for TX interrupt (DONE bit goes to 1)
5. Read REG_TX_STATUS to identify completed slots
6. Clear READY and DONE bits in completed REG_TX_CMD[slot]
7. Repeat
```

**On link-down during TX:**
- Current transmission is aborted
- DONE bit is NOT set
- Driver restarts from slot 0 when link recovers
- CPU must clear all TX command slots on link-down

---

## RX Operation Flow (CPU perspective)

```
1. Wait for RX interrupt (done bit in REG_RX_STATUS goes from 0 to 1)
2. Read REG_RX_STATUS to find which slots have data
3. Read REG_RX_CMD[slot] to get:
     - SIZE (bytes received)
     - EEP_RX (was this an error packet?)
     - MULTI (does data continue in next slot?)
4. Read REG_RX_DATA[slot] for the packet bytes
5. Clear READY bit and DONE bit in REG_RX_CMD[slot]
   (marks slot as free for next reception)
6. Repeat
```

**Important**: The status FIFO is NOT cleared on link-down. The CPU must drain all pending
RX status entries after a link-down event.

**On link-down during RX:**
- Current reception is aborted
- DONE bit is NOT set for the in-progress packet
- Logic restarts from slot 0 once link recovers and a slot is free

---

## Interrupt Sources

Three interrupts per core:
1. **AXI_DMA MM2S** — TX DMA transfer complete
2. **AXI_DMA S2MM** — RX DMA transfer complete
3. **XSC SpaceWire Controller** — TX done / RX packet ready / link errors

All 8 cores' interrupts feed into a Xilinx AXI interrupt controller.

---

## Clock Domains

| Domain | Source | Use |
|--------|--------|-----|
| FPGA Master Clock | PS PLL | TX data output, logic |
| SpaceWire Sampling Clock | FPGA PLL (2× master) | RX oversampling |
| Asynchronous | External SpW | i_din, i_sin inputs (through DDR IOB FF) |

---

## Resource Utilisation (per link)

| Resource | Count |
|----------|-------|
| LUT | ~1000 |
| FF | ~800 |
| RAMB18 | 0 |
| DSP | 0 |

(AXI_DMA and Stream FIFO resources are additional and not included above.)

---

## AXI Interface Summary

| Interface | Count (8 links) | Connected to |
|-----------|-----------------|-------------|
| AXI4-Lite Slave (DMA control) | 8 | M_AXI_GP1 via AXI interconnect |
| AXI4-Lite Slave (SPW control) | 8 | M_AXI_GP1 via AXI interconnect |
| AXI4 Master (DMA data) | 24 (3 per link) | S_AXI_HP0 / S_AXI_HP1 |