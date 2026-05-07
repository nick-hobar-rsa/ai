# Project Plan

> Living document. Update status after each meaningful work session.

---

## Milestones

### M0: Project Init ✅ (Current)
| Task | Status | Notes |
|------|--------|-------|
| Template creation | ✅ Done | BOOT.md, directory structure, standards baseline |
| Hardware interface identification | ⬜ Not started | Awaiting user input |
| Requirements capture (initial) | ⬜ Not started | Depends on hardware spec |
| Development environment validation | ⬜ Not started | All three platforms |

### M1: Requirements & Interface Definition
| Task | Status | Notes |
|------|--------|-------|
| Derive software requirements | ⬜ | From hardware spec + system spec |
| Define HAL interface signatures | ⬜ | Header files with doxygen |
| Interface Control Document (ICD) draft | ⬜ | Hardware ↔ Software boundary |
| Requirements traceability matrix setup | ⬜ | Spreadsheet or tool |

### M2: Architecture & Design
| Task | Status | Notes |
|------|--------|-------|
| Software Design Document (SDD) draft | ⬜ | |
| Platform abstraction design | ⬜ | How HAL implementations are selected |
| Build system design (CMake + Yocto) | ⬜ | Toolchain files, recipes |
| Data flow diagrams | ⬜ | |
| Error handling strategy | ⬜ | |

### M3: Core Implementation
| Task | Status | Notes |
|------|--------|-------|
| HAL interface implementation | ⬜ | |
| Platform layer (macOS stub/mock) | ⬜ | For dev testing |
| Platform layer (Ubuntu stub/mock) | ⬜ | For CI testing |
| Platform layer (Yocto aarch64) | ⬜ | Real hardware |
| Application logic | ⬜ | |

### M4: Verification & Validation
| Task | Status | Notes |
|------|--------|-------|
| Unit tests | ⬜ | Target: ≥80% line coverage |
| Integration tests (mocked HW) | ⬜ | |
| Static analysis | ⬜ | clang-tidy, cppcheck, sparse |
| HIL tests | ⬜ | Requires real hardware |
| SVR compilation | ⬜ | Test results → verification report |

### M5: Deployment & Handoff
| Task | Status | Notes |
|------|--------|-------|
| Yocto recipe integration | ⬜ | |
| Flash/deploy script | ⬜ | |
| Final documentation package | ⬜ | |
| As-built SDD update | ⬜ | |

---

## Sprint Tracking

> Add sprints as work begins. Each sprint = 1-2 week focus window.

| Sprint | Focus | Start | End | Status |
|--------|-------|-------|-----|--------|
| — | — | — | — | — |

---

## Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|------------|--------|------------|--------|
| R1 | Hardware spec unavailable or incomplete | Medium | High | Define HAL early; stub platform layers | Open |
| R2 | Yocto toolchain incompatibility with M3 host cross-compile | Medium | Medium | Test early; use containerized toolchain if needed | Open |
| R3 | Class B documentation burden exceeds Class D budget | Medium | Medium | Scope V&V artifacts to risk; use templates | Open |
| R4 | Real-time constraints on aarch64 require RTOS | Low | High | Confirm scheduling requirements early | Open |
| R5 | Driver access requires kernel modules (not userspace) | Low | High | Confirm hardware interface type early | Open |