# Compliance Matrix — NASA-STD-8739.8

> Class D mandatory = MUST. Class B aspiration = SHOULD where practical.
> Status: 🟢 Compliant | 🟡 Partial | 🔴 Gap | ⬜ Not Yet Assessed | ➖ Not Applicable

---

## Software Assurance Requirements

### Requirements Engineering

| ID | Requirement | Class | Target | Status | Evidence Location |
|----|-------------|-------|--------|--------|-------------------|
| RE-01 | Software requirements derived from system requirements | D MUST | Yes | ⬜ | |
| RE-02 | Requirements traceability to system level | D MUST | Yes | ⬜ | |
| RE-03 | Requirements peer reviewed | B SHOULD | Yes | ⬜ | |
| RE-04 | Requirements baselined under configuration control | D MUST | Yes | ⬜ | |
| RE-05 | Requirements verification criteria defined | D MUST | Yes | ⬜ | |

### Software Design

| ID | Requirement | Class | Target | Status | Evidence Location |
|----|-------------|-------|--------|--------|-------------------|
| SD-01 | Software design documented (SDD) | D MUST | Yes | ⬜ | |
| SD-02 | Design traceable to requirements | D MUST | Yes | ⬜ | |
| SD-03 | Design peer reviewed | B SHOULD | Yes | ⬜ | |
| SD-04 | Interface definitions documented (ICD) | D MUST | Yes | ⬜ | |
| SD-05 | Design baselined under configuration control | D MUST | Yes | ⬜ | |

### Software Implementation

| ID | Requirement | Class | Target | Status | Evidence Location |
|----|-------------|-------|--------|--------|-------------------|
| SI-01 | Coding standards defined and followed | D MUST | Yes | ⬜ | |
| SI-02 | Code reviews performed | D MUST | Yes | ⬜ | |
| SI-03 | No unauthorized dynamic memory allocation | B SHOULD | Yes | ⬜ | |
| SI-04 | No recursion | B SHOULD | Aspirational | ⬜ | May waive for non-critical paths |
| SI-05 | Defensive programming (bounds checks, null checks) | B SHOULD | Yes | ⬜ | |
| SI-06 | No unannotated fallthrough in switch | B SHOULD | Yes | ⬜ | |
| SI-07 | All functions have defined input/output contracts | B SHOULD | Yes | ⬜ | |

### Software Verification

| ID | Requirement | Class | Target | Status | Evidence Location |
|----|-------------|-------|--------|--------|-------------------|
| SV-01 | Unit tests for all software units | D MUST | Yes | ⬜ | |
| SV-02 | Test requirements traceable to software requirements | D MUST | Yes | ⬜ | |
| SV-03 | All requirements verified | D MUST | Yes | ⬜ | |
| SV-04 | Test results documented (SVR) | D MUST | Yes | ⬜ | |
| SV-05 | Code coverage measured and documented | B SHOULD | ≥80% line | ⬜ | |
| SV-06 | Boundary value testing | B SHOULD | Yes | ⬜ | |
| SV-07 | Error handling path testing | B SHOULD | Yes | ⬜ | |
| SV-08 | Static analysis performed | B SHOULD | Yes | ⬜ | clang-tidy + cppcheck |
| SV-09 | Integration testing | D MUST | Yes | ⬜ | |
| SV-10 | Regression test suite automated | B SHOULD | Yes | ⬜ | |

### Configuration Management

| ID | Requirement | Class | Target | Status | Evidence Location |
|----|-------------|-------|--------|--------|-------------------|
| CM-01 | Software under configuration control | D MUST | Yes | ⬜ | Git |
| CM-02 | Baselines established at defined points | D MUST | Yes | ⬜ | Tags |
| CM-03 | Change control process defined | D MUST | Yes | ⬜ | PR workflow |
| CM-04 | Build reproducibility | B SHOULD | Yes | ⬜ | |
| CM-05 | Third-party software tracked | D MUST | Yes | ⬜ | |

### Documentation

| ID | Requirement | Class | Target | Status | Evidence Location |
|----|-------------|-------|--------|--------|-------------------|
| DOC-01 | User documentation if required | D MUST | TBD | ⬜ | |
| DOC-02 | As-built documentation matches code | D MUST | Yes | ⬜ | |
| DOC-03 | Anomalies documented and tracked | D MUST | Yes | ⬜ | |

---

## Coding Standard Reference

**Primary**: C11 (ISO/IEC 9899:2011)
**Style guide**: To be selected (candidates: MISRA C:2012 subset, LLVM coding standards, NASA JPL C coding standard)
**Static analysis rules**: To be defined after style guide selection
**Naming convention**: `snake_case` for C, `PascalCase` for types/structs, `HAL_` prefix for HAL public API, `PLATFORM_` prefix for platform internals

---

## Class B Aspirations — Honest Assessment

These are items where Class B requires something beyond Class D, and we're choosing to adopt them because they're high-value:

1. **Static analysis** — Low cost (tooling exists), high defect-finding value
2. **Code coverage ≥80%** — Forces thorough unit testing, feasible with modern frameworks
3. **Defensive programming** — Good practice regardless of classification
4. **Input/output contracts on functions** — Self-documenting, catches bugs
5. **Traceability from test → requirement → code** — Essential for any real verification

These we're explicitly **not** adopting (Class B relief):

1. **Formal inspection process (Fagan-style)** — Too heavy for Class D budget
2. **Independent V&V team** — Same person/team is acceptable for Class D
3. **No dynamic memory / no recursion** — Aspirational but will waive where impractical
4. **Formal methods or proof** — Far beyond Class D scope