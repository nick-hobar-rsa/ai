# Architecture Decision Records

> Format: Lightweight ADR. Numbered sequentially. Immutable once recorded — if reversed, add new ADR noting supersession.

---

## ADR-001: File-based project memory system

**Date**: (Template creation)
**Status**: Accepted
**Context**: AI assistant has no cross-session memory. Need persistent project state.
**Decision**: Use disk files (BOOT.md, project-plan.md, decisions.md, worklog.md) as persistent memory. Each session begins by reading BOOT.md.
**Consequences**: 
- (+) Survives any session boundary
- (+) Human-readable, auditable
- (-) Requires discipline to update files at session end
- (-) No automatic context loading — user must trigger

---

## ADR-002: CMake as primary build system

**Date**: (Template creation)
**Status**: Accepted
**Context**: Need cross-platform builds across macOS arm64, Ubuntu x86_64, and Yocto aarch64. Yocto natively supports CMake via cmake class.
**Decision**: Use CMake with toolchain files for each platform. Yocto wraps CMake via `inherit cmake`.
**Consequences**:
- (+) Single build definition for all platforms
- (+) Well-understood, wide tooling support
- (+) Native Yocto integration
- (-) CMake verbosity for simple projects
- (-) Toolchain file maintenance across platforms

---

## ADR-003: Hardware Abstraction Layer (HAL) pattern

**Date**: (Template creation)
**Status**: Accepted
**Context**: Software must run on three different platforms with different hardware access mechanisms. Application logic must be hardware-agnostic for testability.
**Decision**: Define pure-C interface headers in `src/hal/`. Implementations live in `src/platform/<env>/`. Application layer links against the appropriate platform object library. No `#ifdef` in application or HAL header code.
**Consequences**:
- (+) Clean separation, testable application layer
- (+) New platforms added without app changes
- (+) Compatible with unit testing via mock implementations
- (-) Function call overhead (negligible for Class D I/O rates)
- (-) Must define interfaces before implementations (upfront design)

---

## ADR-004: No C++ exceptions in embedded target

**Date**: (Template creation)
**Status**: Accepted
**Context**: Yocto aarch64 deployment may have limited runtime support. Exceptions add code size and unpredictable timing.
**Decision**: Compile embedded target with `-fno-exceptions`. All error propagation via return codes (`hal_status_t`). macOS and Ubuntu targets may use exceptions in test code only.
**Consequences**:
- (+) Predictable code size and execution time
- (+) Forces explicit error handling
- (-) Verbose error propagation in deep call stacks
- (-) Test code on dev platforms has different error handling idiom

---

## ADR-005: Conventional Commits for change tracking

**Date**: (Template creation)
**Status**: Accepted
**Context**: Need structured commit history for traceability without heavy tooling.
**Decision**: Use Conventional Commits specification. Types: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`, `ci:`. Scope optional (e.g., `feat(hal): add UART init`).
**Consequences**:
- (+) Machine-parseable history
- (+) Links changes to areas of code
- (-) Minor overhead on commit messages

---

## ADR-006: NASA-STD-8739.8 as compliance baseline

**Date**: (Template creation)
**Status**: Accepted
**Context**: Project requires NASA Class D risk posture with Class B software standard aspirations.
**Decision**: Use NASA-STD-8739.8 (Software Assurance Standard) as the reference standard. Apply Class D mandatory requirements. Selectively apply Class B requirements where they add value without disproportionate cost. Track compliance in `standards.md`.
**Consequences**:
- (+) Clear, well-defined standard with explicit class definitions
- (+) Class D relief documented in the standard itself
- (-) Standard is NASA-internal; some sections reference other NASA docs
- (-) "Class B aspirations" requires judgment calls — document in standards.md