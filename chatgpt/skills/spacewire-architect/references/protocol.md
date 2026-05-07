# SpaceWire Protocol Reference

Source: ECSS-E-ST-50-12C, xsc_q7_zynq_spw_native.md, SpaceWireAPI.md

---

## Protocol Layers

| Layer | Implemented By | Description |
|-------|----------------|-------------|
| Physical | Hardware (LVDS) | Cables, connectors, differential signalling |
| Signal | FPGA logic | DS (Data-Strobe) encoding, bit timing |
| Character | FPGA logic | NULL, FCT, N-Char, time-codes, EEP/EOP |
| Exchange | FPGA logic | Flow control (credit-based), link initialisation |
| Packet | Driver | Packet framing, protocol ID routing |
| Network | Not implemented | Routing (not supported in this implementation) |

---

## Physical Layer

SpaceWire uses **LVDS** (Low-Voltage Differential Signalling) over 4 wires:
- Data+ / Data− (differential pair for data)
- Strobe+ / Strobe− (differential pair for strobe)

The XSC IP core outputs `o_dout` and `o_sout` and samples `i_din` and `i_sin`.

Because there is no clock recovery, the XSC IP oversamples the incoming signals at 2× the
FPGA master clock using a DDR IOB flip-flop and three stages of logic FFs to detect edges on
data and strobe.

---

## DS Encoding (Signal Level)

SpaceWire uses DS (Data-Strobe) encoding rather than a separate clock signal:
- **Rule**: The strobe signal transitions whenever the data signal does NOT transition between
  consecutive bits, and vice versa.
- **Receiver decodes clock** by XOR-ing data and strobe: a transition on either signal = one
  bit period.

This makes SpaceWire self-clocked and allows variable link rates without a fixed reference.

---

## Character Level

### Character types

| Type | Description |
|------|-------------|
| NULL | Two-part control character: ESC + FCT. Sent continuously when idle. |
| FCT | Flow Control Token — grants 8 receive credits to the far end |
| N-Char | Normal data character (8 data bits + 1 parity bit) |
| Time-Code | Two-part control: ESC + time char. Carries 6-bit time value + 2 control flags |
| EOP | End of Packet (data packet terminates normally) |
| EEP | Error End of Packet (data packet terminates with error) |

### Parity

All N-Chars and control characters include a parity bit (odd parity). A parity error is a
fatal link error and triggers the `RUNPARITYERR` / `PARITYERR` status bits.

### ESC Error

An ESC character followed by an unexpected character triggers an ESC error (`RUNESCERR` /
`ESCERR` status bits).

---

## Exchange Level — Flow Control

SpaceWire uses a credit-based flow control system:

- Each side maintains a **credit counter** for the far end.
- An FCT character grants **8 receive buffer slots** to the sender.
- The sender decrements its credit count by 1 for each N-Char sent; it must not send if
  credit = 0.
- A **credit error** occurs if a node sends more N-Chars than its credit allows.
  - `CREDITERRTX` / `RUNCREDITERRTX`: TX side exceeded credit
  - `CREDITERRRX` / `RUNCREDITERRRX`: RX side detected credit violation

The `REG_STATUS` bit 13 (`CREDIT_AVAIL`) indicates that credit is available for transmission.

---

## Link Initialisation State Machine

The ECSS-E-ST-50-12C link state machine:

```
        ┌───────────────────────────────────────────────────┐
        │                Error Reset (0)                     │
        │  • Reset TX, RX logic                              │
        │  • Send NULLs                                      │
        └────────────────┬──────────────────────────────────┘
                         │  Timer expires (6.4 µs min)
                         ▼
        ┌───────────────────────────────────────────────────┐
        │                Error Wait (1)                      │
        │  • Continue sending NULLs                          │
        │  • Wait for link to be silent                      │
        └────────────────┬──────────────────────────────────┘
                         │  Timer expires (12.8 µs min) + NULL received
                         ▼
        ┌───────────────────────────────────────────────────┐
        │                Ready (2)                           │
        │  • Send NULLs, receive NULLs                       │
        │  • First NULL received                             │
        └────────────────┬──────────────────────────────────┘
                         │  First FCT received
                         ▼
        ┌───────────────────────────────────────────────────┐
        │                Started (3)                         │
        │  • Send FCTs                                       │
        │  • First FCT received                              │
        └────────────────┬──────────────────────────────────┘
                         │  First N-Char received
                         ▼
        ┌───────────────────────────────────────────────────┐
        │               Connecting (5)                       │
        │  • First N-Char received                           │
        └────────────────┬──────────────────────────────────┘
                         │  FCT received
                         ▼
        ┌───────────────────────────────────────────────────┐
        │                  Run (6)                           │
        │  • Full duplex data transfer active                │
        │  • Time-codes valid                                │
        └────────────────────────────────────────────────────┘
```

**Any error in Run state → immediately transition back to Error Reset (0).**

The XSC `REG_LINK_CTRL_STATE` register reports the current state (bits 6:4).

### Status bits during initialisation

| REG_LINK_CTRL_STATE bit | Meaning |
|-------------------------|---------|
| Bit 0 | First NULL received |
| Bit 1 | First NCHAR received |
| Bit 2 | First time char received |
| Bit 3 | Run mode active |

---

## Timecodes

- Timecodes are transmitted **between** data packets, never inside them.
- They carry a 6-bit counter value (0–63) and 2 control flags.
- The sending node increments the 6-bit counter by 1 and transmits.
- The receiving node checks that the received counter = last seen counter + 1. If not, a
  timecode error is indicated.
- Timecodes are used for **network-wide time distribution** in multi-node SpaceWire systems.

In the XSC implementation:
- **Send**: Write the 8-bit value to `REG_TIME_TO_LINK` (0x14) — transmission is immediate.
- **Receive**: `REG_TIME_FROM_LINK` (0x10) holds the last received timecode value.
  The `TIME_TOKEN_RX` bit (bit 28) in `REG_STATUS` is set when a new timecode arrives.
- Via socket API: use `SIOCSTIMETX` ioctl to send, `SIOCSTIMEREG` + `SIG_TIME_CODE` signal
  to receive.

---

## Error Types and Root Causes

| Error | Typical Root Cause | Recovery |
|-------|-------------------|----------|
| Disconnect | Cable disconnected, power loss on far end, EMI | Re-initialise link |
| Parity | Signal integrity issue, cable damage, connector fault | Check physical layer |
| ESC | Corrupted control character sequence | Check signal integrity |
| Credit TX | Software sent more N-Chars than available credit | Software bug — check flow |
| Credit RX | Far end violated credit limit | Far-end software/hardware bug |
| Got NCHAR not in Run | Far end is in Run, local end is not | Timing / startup race |
| Got TimeChar not in Run | Timecode received during initialisation | Check startup sequence |

---

## Disconnect Error — Special Handling

A disconnect error (`DISCERR` / `RUNDISCERR`) means the link has gone electrically silent
(no transitions detected) for longer than the disconnect timeout (nominally 850 ns at
10 Mbps). This is the most common error in a real system.

Recovery procedure:
1. Read `REG_STATUS` to confirm `DISCERR` or `RUNDISCERR` is set.
2. Write `REG_STATUS_CLR` to clear the error bit.
3. Bring the link down via `REG_CTRL` (set `LINK_DISABLE = 1`).
4. Wait ≥ 6.4 µs (Error Reset timer) + 12.8 µs (Error Wait timer) — in practice wait ≥ 1 ms.
5. Re-enable the link (`AUTOSTART = 1` or `MANUAL_START = 1`).
6. Poll `REG_LINK_CTRL_STATE` until state = Run (6) or timeout.

---

## Packet Level

A SpaceWire packet consists of:
```
[ Optional Address Bytes ] [ Data Bytes ] [ EOP or EEP ]
```

- **Address bytes**: Only needed when routing through a router. In a point-to-point system
  (FPGA ↔ flight unit) they are omitted. The XSC implementation does not support routing.
- **EOP**: End of Packet — normal termination.
- **EEP**: Error End of Packet — signals that the packet was terminated due to an error.

The XSC driver's `SPW_RMAP`, `SPW_CCSDS`, `SPW_NATIVE` socket types use the first data byte
after any routing bytes as the **protocol identifier** to demultiplex packets to the correct
socket. RMAP = 0x01, CCSDS = 0x02, NATIVE = 0xF0 (240).