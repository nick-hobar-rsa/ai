---
name: spacewire-architect
description: >
  Expert guide for SpaceWire in the Sky Auger / ORTHUS flight software system (Earendel/sw).
  Use for any question about SpaceWire C code, STAR-API usage, AF_SPW sockets, RMAP, EOP/EEP,
  timecodes, link errors, UIO subsystem integration, spw_channel_t structure, channel/port
  mapping, project code style standards, build system, or HAL design targeting STAR-Dundee USB
  Brick Mk4 (ground) and XSC FPGA IP core (flight). Trigger for partial questions like "open a
  channel", "send RMAP", "handle a disconnect", "what is uio_id", "channel port mapping", or
  "write a function header". Covers the full SpaceWire stack plus Sky Auger-specific
  architecture: UIO integration, spw_channel_t static arrays, camera SpaceWire dispatch,
  hardware-verified ORTHUS channel mapping, device discovery fallback, and STAR_CHANNEL_ID
  handle vs channel index distinction.
---

# SpaceWire Architect Skill

This skill helps you implement a production-quality SpaceWire subsystem in C for an embedded
Yocto Linux system, targeting the Sky Auger / P198 ORTHUS payload.

## Hardware Targets

| Target | API | Use case |
|--------|-----|----------|
| STAR-Dundee USB Brick Mk4 | STAR-API (`star-api.h`) | Ground testing / dev machine |
| XSC FPGA IP Core (Zynq) | Linux `AF_SPW` sockets | Flight system (Q8) |

**The primary design goal is a unified HAL** so flight code never directly calls either API —
it always calls your abstraction layer, which dispatches to the right backend.

The internal flight codebase (`bridge/`) implements SpaceWire through a **UIO subsystem**
using statically allocated `spw_channel_t` arrays. See `references/internal-architecture.md`
for how this maps to the HAL concept and for project-specific conventions.

---

## Reference Files — Load As Needed

| File | When to read it |
|------|----------------|
| `references/star-api.md` | STAR-Dundee USB Brick Mk4 API — device list, channel open/close, TX/RX, device discovery fallback, `STAR_CHANNEL_ID` handle clarification |
| `references/xsc-socket-api.md` | XSC/Xiphos Linux socket API — `AF_SPW`, link control, `send`/`recv`, EOP/EEP, errors |
| `references/fpga-ip-core.md` | XSC FPGA IP core registers, command/status FIFOs, DMA, interrupt handling |
| `references/rmap.md` | RMAP protocol — packet structure, read/write commands, reply handling |
| `references/abstraction.md` | Unified HAL design — `spw_hal_t` interface, backend registration, example patterns |
| `references/protocol.md` | SpaceWire protocol layers — physical, signal, character, exchange, packet, timecodes |
| `references/internal-architecture.md` | **Sky Auger-specific** — UIO integration, `spw_channel_t`, channel/port mapping, code style, build system, camera dispatch pattern, known issues |

Always load the most relevant reference file(s) before writing code or answering questions.
For tasks spanning multiple areas (e.g. "write an RMAP initiator with error recovery"), load
multiple files.

---

## Quick Decision Guide

**User wants to write C code for ground testing (USB Brick)?**
→ Load `references/star-api.md`

**User wants to write C code for flight (FPGA/Linux)?**
→ Load `references/xsc-socket-api.md` + `references/fpga-ip-core.md`

**User wants a HAL / abstraction layer?**
→ Load `references/abstraction.md` (+ both API references)

**User wants to send/receive RMAP commands?**
→ Load `references/rmap.md` + the appropriate backend API reference

**User asks about protocol theory, errors, timecodes, state machines?**
→ Load `references/protocol.md`

**User asks about link errors, disconnect, parity, credit errors?**
→ Load `references/xsc-socket-api.md` (error table) + `references/protocol.md`

**User asks about internal flight software architecture, UIO integration, `spw_channel_t`,
channel/port mapping, project code style, build system, camera SpaceWire dispatch, or known
ORTHUS bugs?**
→ Load `references/internal-architecture.md`

**User asks about device discovery, `STAR_CHANNEL_ID` vs channel index, or the dev machine
fallback pattern?**
→ Load `references/star-api.md`

---

## Sky Auger Project Context

- **Mission**: Sky Auger, Payload P198 "ORTHUS" — Reentry Data Processor
- **Flight computer**: Xiphos Q8 (Zynq-based, FPGA + ARM Cortex-A9), running Yocto Linux
- **Ground test hardware**: STAR-Dundee USB SpaceWire Brick Mk4 (dev machine, Ubuntu/x86)
- **Cameras**: 3D PLUS CMV4000 (3DCM734 / 3DCM739), connected via SpaceWire
- **Internal codebase**: Earendel/sw repository, `bridge/` module for SpaceWire + UIO + RTOS
- **Custom layer**: `meta-orthus` Yocto layer for all payload-specific recipes and config
- **FSW language**: C (flight paths), shell/Python (tooling only)
- **Coding standard**: NASA Class B posture, C99, MISRA-C where practical
- **Key constraint**: No dynamic memory allocation in flight-critical paths — static arrays only
- **Reference impl**: `camera_c` is a hardware-verified functional analog, not the flight build

---

## Core Design Principles

When writing SpaceWire code for this project, always apply these rules:

1. **HAL-first**: All flight code calls `spw_hal_*()` functions. Never let protocol logic
   bleed into hardware-specific code. See `references/abstraction.md`.

2. **Always check return codes**: Both STAR-API and the socket API fail silently if you ignore
   errors. Every `STAR_*` function and every `send`/`recv` syscall needs error handling.

3. **Buffer before receiving**: On the socket API, bring the link up before opening a socket.
   On STAR-API, always open channels in buffered mode (last arg = 1) for RX paths.

4. **EOP vs EEP matters**: EOP = clean end of packet. EEP = error end of packet. The flight
   software must inspect EEP status on receive and propagate it up. Never silently discard EEP.

5. **Link state machine awareness**: SpaceWire links go through Error Reset → Error Wait →
   Ready → Started → Connecting → Run. Your code must handle link-down events gracefully —
   do not spin-wait on TX after a disconnect. See `references/protocol.md`.

6. **Timecodes are out-of-band**: Timecodes are higher priority than data and always sent
   between packets. Use the dedicated timecode ioctl/API, not the data path.

7. **Dual-target parity**: Whenever you implement a feature for one backend, implement the
   HAL stub for the other. Keep both backends at feature parity at all times.

---

## Typical Task Patterns

### "Help me open a link and send a packet"
1. Load `references/xsc-socket-api.md` (flight) or `references/star-api.md` (ground)
2. Show link-up sequence → socket/channel open → send with EOP → error check
3. Wrap in HAL function signature from `references/abstraction.md`

### "Help me implement RMAP read/write"
1. Load `references/rmap.md` for packet structure
2. Load backend API reference for how to send/receive raw bytes
3. Show full command → send → receive reply → parse reply pattern

### "My link keeps dropping, how do I handle errors?"
1. Load `references/xsc-socket-api.md` for the error code table
2. Load `references/protocol.md` for the link state machine
3. Show the recovery pattern: detect error → bring link down → wait → bring back up

### "Design the SpaceWire subsystem for my flight software"
1. Load `references/abstraction.md` for the HAL structure
2. Load both backend references
3. Produce `spw_hal.h`, `spw_backend_fpga.c`, `spw_backend_brick.c` skeleton