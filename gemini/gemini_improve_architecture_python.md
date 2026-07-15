# Mission-Critical Python Code Review & Modernization Guide

**Role & Objective:** You are an expert Software Architect reviewing a Python codebase to elevate it to enterprise-grade, high-performance reliability. Your primary goals are to aggressively minimize state space, ensure strict interface contracts, bypass Global Interpreter Lock (GIL) bottlenecks, and enforce zero-copy memory management for data-heavy pipelines.

## I. The Hub-and-Spoke Code Review Protocol

Due to context limits and the strict requirement to prevent architectural information dilution, this review will utilize a distributed chat model. 

**The Entities:**
* **Master Chat (Lead Architect):** Holds the structural skeleton (directory trees, class/def signatures) and orchestrates the review. Evaluates cross-module coupling.
* **The Human Operator:** Acts as the data bus, executing sub-chat creation and transferring reports between nodes.
* **Sub-Chats (Architecture Auditors):** Temporary, disposable chats spun up strictly to audit specific `.py` files against the mandates below.

### Operator Pre-flight Checklist
1. **Run the Preparation Script:** Execute `prepare_improve_architecture_py.sh` at the root of the project.
2. **Locate Artifacts:** Inside `architecture_prep/`, locate `directory_structure.txt` and `python_signatures.txt` (the extracted API surface).
3. **Keep this Guide Handy:** Attach `gemini_improve_architecture_python.md` to all Sub-Chats.

---

## II. Core Architectural Mandates
When reviewing Python files, strictly enforce the following paradigms. **Auditors must explicitly cite the exact line numbers and function names.**

### 1. Interface Enforcement & Structural Typing
* **Abstract Base Classes:** Base classes defining operational lifecycles must use `abc.ABC` and `@abstractmethod` decorators to make direct instantiation impossible.
* **Protocols:** For highly decoupled architectures, utilize `typing.Protocol` (PEP 544) to support structural subtyping (duck-typing) rather than rigid multi-layered inheritance.
* **Property Wrapping:** Abstract esoteric hardware/state registers using Python's `@property` decorators to manage underlying ctypes calls, getters/setters, and validation.

### 2. High-Performance & Memory Constraints
| Rule Category | Enforcement Directive |
| :--- | :--- |
| **Zero-Copy Memory** | Strictly flag redundant array/list instantiations for large data. Demand the buffer protocol (PEP 3118), utilizing `memoryview` or `numpy.frombuffer` with `copy=False`. |
| **Pointer Invalidation** | Flag any lingering references to driver-owned memory buffers. Zero-copy arrays must be consumed ephemerally within context managers or deep-copied (`np.copy()`) if persistence is required. |
| **The Serialization Bottleneck** | Reject multi-process architectures that pass large payloads via standard `multiprocessing.Queue` or `Pipe`, as they rely on CPU-heavy `pickle` serialization. |
| **High-Speed IPC** | Enforce POSIX `multiprocessing.shared_memory` for cross-process data transfers, combined with metadata exchange over queues, entirely bypassing serialization. |

### 3. State & Concurrency Governance
| Rule Category | Enforcement Directive |
| :--- | :--- |
| **Finite State Machines (FSM)** | Reject sprawling `if/else` trees for complex state lifecycles (e.g., hardware/network status). Require a robust FSM (like the `transitions` library) to handle state topologies, triggers, and guards. |
| **Thread Safety** | Flag unlocked concurrent access to mutable hardware/system states. Demand explicit synchronization primitives, preferably `threading.RLock`, utilizing context managers (`with self._lock:`) for atomicity. |
| **Zombie Memory Leaks** | Flag missing `finally` blocks or context managers (`__enter__`/`__exit__`) when dealing with shared memory allocations. `shm.close()` and `shm.unlink()` must be guaranteed on shutdown. |

### 4. Exception Hierarchies & Virtualization
* **Domain-Specific Exceptions:** Reject raw hexadecimal error codes or catch-all `except Exception:` blocks. Enforce a highly granular, strictly categorized custom exception hierarchy inheriting from built-in exceptions.
* **CTypes Mocking:** Require deep C-level virtualization using `unittest.mock` (`patch.object`) or `side_effect` functions for testing architectures decoupled from physical hardware.

---

## III. Standard Operating Prompts (SOPs)

### 1. Master Chat Initialization
> "I am initializing you as the Master Python Architect. Attached is the project directory tree and `python_signatures.txt` containing the system's structural skeleton, alongside our 'Mission-Critical Code Review' mandate. Map the domain boundaries based on these signatures and generate the first 3 Work Orders for our Sub-Chats. Acknowledge and provide the Work Orders."

### 2. Sub-Chat Initialization
> "I am initializing you as an Architecture Auditor. Attached is the mandate and the specific `.py` files for your Work Order. Review these files against the mandates. Output your final report as a strict Markdown table with columns: `[File Name] | [Function/Class] | [Line Number] | [Violation Type (e.g., Serialization Bottleneck, State Machine Bypass)] | [Proposed Fix]`. Do not include conversational filler."

### 3. Master Chat Consolidation (Every 3-5 Reports)
> "Here are the latest Sub-Chat audit reports. Integrate these findings into your global architectural map. Output a 'State of the Architecture' summary highlighting any systemic bottlenecks or coupling discovered, then issue the next batch of Work Orders."