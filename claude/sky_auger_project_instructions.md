# Sky Auger Project Instructions

## Project Identity

**Project Name:** Sky Auger
**Payload Designation:** P198 "ORTHUS" — Reentry Data Processor
**Mission Phase:** Development → Flight-Ready Delivery
**Master Goal:** Arrive at a fully functional, tested, and flight-ready hardware/software system for delivery to the host spacecraft.
**Project Scale:** This is a NASA Class-D risk posture mission overall.

---

## Payload Overview

**System Components:**
- **Flight Computer Enclosure (FCE):** Houses the Flight Computer (FC) and associated electronics.
- **Wide Field of View Curved Sensor (WFOV-C) Cameras:** Two units providing optical imagery through capsule windows during hypersonic reentry.
- **GNSS Receiver:** With associated mounting and harnessing.
- **Harnessing:** All electrical interfaces between the FC, cameras, GNSS, and host spacecraft.

**Primary Flight Test Objective:**
Demonstrate in-space operation of the WFOV-C cameras and flight computer by collecting imagery through capsule windows during hypersonic reentry.

**Secondary Objective:**
Raise the TRL (Technology Readiness Level) of key hardware and software components for the WFOV-C build. Post-landing imagery will be used to develop real-time navigation algorithms and guide future design evolutions.

**Out of Scope for This Mission:**
Real-time processing of image data into navigation estimates. The system captures and stores data; navigation algorithm execution is a future capability.

---

## Technical Domain

The development work on this project spans two primary technical areas:

### 1. Embedded Flight Software (FSW)
- **OS/Platform:** Yocto Linux (embedded, flight-hardened configuration)
- **Primary Language:** C (flight software), with shell/Python tooling where appropriate
- **Key Subsystems:**
  - Camera interface and image capture sequencing (WFOV-C × 2)
  - GNSS data acquisition and timestamping
  - Data storage and file management (onboard mass storage)
  - Health monitoring and fault detection/isolation/recovery (FDIR)
  - Power sequencing and state machine management
  - Host spacecraft interface (command & telemetry — protocol TBD per ICD)
  - Boot, initialization, and watchdog management

### 2. System Design
- Hardware/software interface (HSI) definition
- Interface Control Documents (ICDs) with host spacecraft
- Electrical and mechanical integration planning
- Test architecture: unit, integration, environmental, and acceptance testing

---

## Software Development Standards

While understanding the **Project Scale** for this mission, apply **NASA Class B Software** standards as the governing framework. Key implications:

### Classification Rationale
Class B applies to software where failure could result in mission loss without risk to human life but with significant programmatic consequence. All FSW on P198 shall be treated as Class B, while understanding the **Project Scale** to trim possibly unnecessary steps.

### Required Practices
- **NASA-STD-8739.8** (Software Assurance Standard) — assurance activities, peer reviews, anomaly tracking
- **NASA-STD-2100-91** (C Style Guide) or equivalent coding standard — enforced via static analysis
- **NPR 7150.2** (NASA Software Engineering Requirements) — tailor to project scale, document all tailoring decisions
- **Software Development Plan (SDP):** Maintain a living SDP covering lifecycle, roles, tools, and metrics -- ASPIRATIONAL, but not required.
- **Software Requirements Specification (SRS):** All FSW requirements shall be uniquely identified, traceable, and verifiable -- ASPIRATIONAL, but not required.
- **Software Design Document (SDD):** Architecture, module decomposition, data flow, and state machines documented before implementation
- **Version Control:** All source code, build scripts, and configuration under version control (Git). Branching strategy shall be defined in the SDP
- **Static Analysis:** Apply a static analysis tool (e.g., PC-lint, Polyspace, cppcheck) to all flight C code. No unresolved HIGH severity findings at delivery
- **Code Reviews:** Peer review required for all FSW changes merged to the main/flight branch. Review records shall be retained -- IGNORE for now.
- **Unit Testing:** Target ≥ MC/DC coverage for safety-critical modules; statement coverage tracked for all modules
- **Anomaly/Defect Tracking:** All software anomalies discovered during test shall be logged, dispositioned, and closed before delivery
- **Build Reproducibility:** Hermetic, documented build environment. Yocto layer configuration pinned and under version control
- **Software Release Records:** Each candidate flight build shall have an associated Software Version Description (SVD) document -- IGNORE for now.

### Coding Standards for C Flight Software
- No dynamic memory allocation after initialization
- No recursion in flight-critical paths
- All functions shall have a single, well-defined purpose
- All external inputs validated before use
- All error/return codes checked
- Avoid compiler-specific extensions; target a defined C standard (C99 recommended)
- Cyclomatic complexity limits enforced (target ≤ 15 per function)
- Use of MISRA-C guidelines where practical (document deviations)

### Code Formatting Guidelines
When possible follow these guidelines for style:
- single line comments should usually be with "//" in C/C++ language

- Example file header comment block
/****************************************************************************
*
* File: spw.c
*
* Description:
*   This file implements the SpaceWire channels, and is responsible for
*   interfacing the software to SpaceWire hardware.
*
*                           COPYRIGHT NOTICE
*            Copyright (C) 2026, Rhea Space Activity, Inc.
*                         All rights reserved
*
*   License from Rhea Space Activity required.
*
****************************************************************************/

- Example of typical section header names in files
/********** macros **********/
/********** module globals **********/
static spw_channel_t *id_map[UIO_NUM_CHANNELS];
/********** globals **********/
bool spw_debug = true;
/********** prototypes for private functions **********/
/********** private functions **********/
/********** public functions **********/

- Example function header comment block
/**************************************************************************
*
* Function: spw_close
*
* Description: Close the given channel
* Entry:
*   uio_id is the uio id of the channel to open
* Exit:
*   if channel_ptr is open
*       SpaceWire device/channel closed
*   else
*       no changes
* Function return:
*   true if device/channel successfully closed, or already closed
*   false otherwise
* Globals:
*   spw_debug read
* Author: Chris Grasso
* Creation date: 05/31/2024
**************************************************************************/


---

## Yocto Linux Guidelines

- Maintain a dedicated `meta-orthus` layer for all payload-specific recipes, kernel config fragments, and device tree overlays
- Document all kernel configuration choices that deviate from the baseline BSP
- Minimize the installed package set to the minimum required for flight operation (attack surface reduction)
- No interactive shells or unnecessary services in the flight image
- Init system configuration (systemd or SysV) shall be documented; services shall have defined startup order and failure behavior
- Cross-compilation toolchain version shall be pinned and documented
- All third-party open-source components shall have license review records

---

## Hardware Interfaces (Known)

| Interface | Description |
|---|---|
| WFOV-C Camera × 2 | Image data, sync/trigger signals — interface type TBD per camera ICD |
| GNSS Receiver | Position/time data — likely serial (UART/RS-422) |
| Host Spacecraft | Command uplink, telemetry downlink, power — per spacecraft ICD |
| Mass Storage | Onboard image and telemetry data storage |
| Watchdog | Hardware watchdog timer — must be serviced by FSW |

*All interface details shall be captured in a Hardware/Software Interface Control Document (MICD/SWEICD) document and kept current throughout development.*

---

## Test Philosophy

**Test early, test often. No untested code shall be delivered as flight software.**

- **Unit Tests:** Written alongside code. Stubs/mocks used for hardware-dependent modules
- **Hardware-in-the-Loop (HIL):** Test FSW against representative hardware as early as possible
- **Environmental Testing:** Thermal, vibration, and radiation considerations shall be reflected in test plans
- **Acceptance Testing:** Formal acceptance test procedure (ATP) executed against the flight unit prior to delivery
- **Test Coverage Reports:** Generated and reviewed at each major milestone

---

## Project Milestones (Generic — Tailor as Needed)

| Milestone | Description |
|---|---|
| SRR | Software Requirements Review — SRS baselined |
| PDR | Preliminary Design Review — SDD and architecture complete |
| CDR | Critical Design Review — FSW design frozen, unit test plans complete |
| SIT | Software Integration Testing complete |
| ETR | Environmental Test Readiness — FSW stable on flight hardware |
| FRR | Flight Readiness Review — all anomalies closed, SVD delivered |

---

## How Claude Should Help on This Project

When assisting on Sky Auger tasks, Claude should:

1. **Default to NASA Class B rigor.** Suggest practices, structures, and documentation consistent with Class B FSW unless a specific task is explicitly scoped otherwise. Remember the **Project Scale**
2. **Prioritize safety and correctness over cleverness.** In flight software contexts, readable, verifiable, and provably correct code is always preferred over clever or compact implementations.
3. **Flag interface assumptions.** If a request involves hardware interfaces not yet fully defined, call this out and suggest placeholder ICDs or TBD markers rather than hardcoding assumptions silently.
4. **Produce traceable artifacts.** When writing requirements, tests, or design documents, structure them so that individual items can be uniquely identified and cross-referenced.
5. **Be explicit about tailoring decisions.** If a full NASA standard practice is disproportionate for this project's scale, suggest a tailored approach and document the rationale — don't silently omit required elements.
6. **Code in C for FSW, Python/shell for tooling.** Do not suggest higher-level languages for flight-critical paths.
7. **Respect the mission scope.** Real-time optical navigation processing is explicitly out of scope. Do not suggest architecture decisions that would complicate or commit to that capability unless asked.
8. **Surface risks proactively.** If a design decision carries schedule, reliability, or integration risk, say so clearly with a suggested mitigation.
9. **Keep Yocto layers clean.** All payload customizations go in `meta-orthus`. Never suggest modifying upstream BSP layers directly.
10. **Support review readiness.** When producing design or code artifacts, structure them as if they will go in front of a NASA peer review board — clear, complete, and defensible.

---

*These instructions are a living document. Update them as interfaces are defined, milestones are passed, and scope evolves.*