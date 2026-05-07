# BOOT.md — Project Context Loader

> **READ THIS FIRST** at the start of every session.
> This file is the single source of truth for resuming work.

---

## Resume Instructions

1. Read this file (`BOOT.md`) completely
2. Read `project-plan.md` for milestone status
3. Read `decisions.md` for architectural choices already made
4. Read `standards.md` for compliance posture and open gaps
5. Read `environments.md` for cross-platform build context
6. Check `worklog.md` for what happened in the last session
7. Ask the user: "We left off at [current phase]. Continue, or pivot?"

---

## Project Overview

| Field | Value |
|-------|-------|
| **Project Name** | (Set on project init) |
| **Domain** | Hardware-interfacing software (sensors, actuators, embedded controllers) |
| **Risk Classification** | NASA Class D (low consequence of failure) |
| **Software Standard Target** | NASA-STD-8739.8 Class B aspirations where practical |
| **Lifecycle Model** | Incremental / Spiral — small deliverables, frequent validation |
| **Current Phase** | INIT — Template created, awaiting project specifics |

### What "Class D with Class B aspirations" Means Here

- **We DO**: Requirements tracing, code reviews, unit testing with coverage metrics, interface control documentation, configuration management, peer review of all changes
- **We DON'T** (Class D relief): Formal proof, full independent V&V team, multi-level formal inspections (unless scope warrants it), mandatory static analysis with zero waivers
- **We ASPIRE TO**: Static analysis with disciplined waiver process, automated regression, hardware-in-the-loop test coverage, documented test-as-you-code

---

## Architecture Summary

```
┌─────────────────────────────────────────────┐
│              Application Layer               │
│            (app/ — business logic)           │
├─────────────────────────────────────────────┤
│           Hardware Abstraction Layer         │
│     (hal/ — portable interface definitions)  │
├──────────┬──────────┬───────────────────────┤
│ Platform │ Platform │      Platform          │
│  macOS   │  Ubuntu  │   Yocto/Embedded       │
│ (M3 ARM) │  (x86)   │   (aarch64)            │
│platform/ │platform/ │    platform/           │
└──────────┴──────────┴───────────────────────┘
          │           │             │
          ▼           ▼             ▼
       Hardware    Hardware      Hardware
       (USB/UART)  (USB/UART)   (Direct GPIO/
                                SPI/I2C)
```

**Key principle**: All hardware access goes through the HAL. Platform directories contain *only* HAL implementations. The app layer never includes a platform header directly.

---

## Target Environments

| Environment | OS | Arch | Compiler | Use Case |
|-------------|----|------|----------|----------|
| Dev Primary | macOS 14+ | arm64 (M3) | Clang 15+ | Development, unit tests, debugging |
| Dev Secondary | Ubuntu 24.04 | x86_64 | GCC 13+ | CI/CD, integration testing, cross-compile host |
| Deployment | Yocto (Kirkstone+) | aarch64 | GCC aarch64-linux | Embedded target, final binary |

See `environments.md` for detailed setup instructions and toolchain specs.

---

## Directory Map

```
my-project/
├── BOOT.md                 ← YOU ARE HERE
├── project-plan.md         ← Milestones, status, sprint plan
├── decisions.md            ← Architecture Decision Records
├── standards.md            ← Compliance checklist and gap analysis
├── environments.md         ← Per-platform setup and toolchain guide
├── worklog.md              ← Timestamped session activity
├── src/
│   ├── hal/                ← Hardware Abstraction Layer (interfaces)
│   ├── drivers/            ← Specific driver implementations (behind HAL)
│   ├── app/                ← Application logic (hardware-agnostic)
│   └── platform/           ← Platform-specific HAL implementations
│       ├── macos_arm64/
│       ├── ubuntu_x86_64/
│       └── yocto_aarch64/
├── tests/
│   ├── unit/               ← Pure unit tests (no hardware)
│   ├── integration/        ← Tests with mocked/stubbed hardware
│   ├── hil/                ← Hardware-in-the-loop (requires real HW)
│   └── static/             ← Static analysis configs and reports
├── docs/
│   ├── sdd/                ← Software Design Documents
│   ├── svr/                ← Software Verification Reports
│   ├── itr/                ← Interface Test Reports
│   └── adr/                ← Formal ADRs (if needed beyond decisions.md)
├── references/             ← Reference docs, datasheets, API specs
├── scripts/                ← Build, flash, test automation scripts
├── config/
│   ├── yocto/              ← Yocto layer files, recipes, bbappends
│   └── cmake/              ← CMake modules and toolchain files
└── build/                  ← Build output (gitignored)
```

---

## Current State

**Phase**: INIT
**Blockers**: None
**Open Questions**:
- What is the specific hardware interface? (UART, SPI, I2C, USB, GPIO, CAN?)
- What is the data domain? (telemetry, control, image processing, motor control?)
- Is there an existing Yocto layer to integrate with, or are we building from scratch?
- What is the target MCU/SoC for the aarch64 deployment?
- Are there existing requirements, or do we need to derive them?

**Last Session Summary**: Template creation only. No project-specific work done.

---

## Conventions

- **Branching**: `main` is protected. All work on feature branches. PR required.
- **Commits**: Conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`)
- **Requirements tracing**: Every requirement gets an ID `REQ-XXX`. Code comments reference it. Tests assert it.
- **HAL naming**: All HAL functions prefixed `hal_<subsystem>_<action>()` — e.g., `hal_uart_init()`, `hal_spi_transfer()`
- **Error handling**: All HAL functions return `hal_status_t` (OK, ERROR, TIMEOUT, BUSY, INVALID_PARAM). No exceptions in embedded code.
- **Platform detection**: CMake handles platform selection via toolchain files. No `#ifdef` in app/ or hal/ headers.