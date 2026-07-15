# agent-workspace

## Prerequisites
* **macOS** (M-series Apple Silicon recommended for local inference)
* **Ollama:** Running any model locally.
* **Pi Agent Harness:** Installed via `npm install -g --ignore-scripts @earendil-works/pi-coding-agent` or bun.
* **Bun:** For executing the TypeScript engine scripts (`bun run`).
* **Clang/LLVM:** For local C compilation and sanitizers (`-fsanitize=address,undefined`).

## Directory Structure

```text
agent-workspace/                     # Root workspace for day-to-day coding and agent self-improvement.  
├── .pi/                             # Pi's internal state, skills, and extensions directory.  
│   ├── history.json                 # Pi's ongoing session history (the execution trace log).  
│   ├── self_harness/                # The offline self-improvement engine (do not run during active coding).  
│   │   ├── candidates/              # Ephemeral storage for proposed rule updates (e.g., candidate_AGENTS.md).  
│   │   |   ├── candidate_skills/    # Ephemeral storage for proposed skill updates.  
│   │   ├── orchestrator.ts          # Master script to run the full self-improvement loop in the background.  
│   │   ├── patch_history.json       # Log exactly when and why a specific rule was added to AGENTS.md.  
│   │   ├── proposer.ts              # Agent script that generates a fix/rule based on the mined weakness.  
│   │   ├── traces/                  # Directory for isolated, truncated failure logs captured from history.json.  
│   │   ├── validator.ts             # Orchestrates the headless regression testing in the sandbox.  
│   │   └── weakness_miner.ts        # Analyzes traces against the taxonomy to diagnose the root cause of a failure.  
│   └── skills/                      # Custom Pi commands and capabilities.  
│       ├── compiler_run.ts          # Skill to trigger the C compiler and assert strict safety checks.  
│       ├── flag_failure.ts          # Skill (/flag) to manually capture the last N turns to the traces/ folder.  
│       └── open_code.ts             # Skill to interact with external tools or open the IDE.  
│  
├── AGENTS.md                        # MUTABLE: The agent's active, project-specific behavioral rules. Updated by the proposer.  
├── README.md                        # This file.  
├── SYSTEM.md                        # IMMUTABLE: The strict core persona (NASA Class B/D FSW constraints, C-only paths).  
├── TODO.md                          # Simple, text-based state management for active tasks and objectives.  
│  
├── benchmark/                       # The Micro-Regression Test Suite (Validation Phase).  
│   ├── 01_test_PID/                 # A static test case to evaluate the agent's C coding compliance.  
│   │   ├── run_test.sh              # Evaluates the code (e.g., checks for malloc, runs compiler).  
│   │   ├── task_prompt.md           # The deterministic prompt fed to the headless agent during validation.  
│   │   └── test_pid.c               # The static dummy file the agent must fix/refactor.  
│   ├── run_test_suite.sh            # Master script that iterates over all test cases in the sandbox.  
│   └── sandbox/                     # Ephemeral testing ground. Wiped clean before every validation run.  
│  
├── config/                          # Safe baselines and structural definitions.  
│   ├── base_AGENTS.md               # A known-good backup of AGENTS.md to revert to if a proposed rule breaks the agent.  
│   └── failure_taxonomy.json        # A strict diagnostic menu (e.g., "Blind Loop", "Format Drift") for the weakness miner.  
│  
└── src/                             # Project Code: The actual day-to-day flight software repository (e.g., C source files).  
```


## Workflow

### Phase 1: Interactive Coding & Failure Capture

Actively using the Pi harness to develop safety-critical flight software features on the Mac.

1. **The Programming Session:** Prompt Pi to implement a specific sub-feature (e.g., a tracking filter or sensor parsing routine) inside the `src/` directory.
2. **The Agent Stumble:** The model successfully writes the logic but misses a strict safety requirement. For example, it forgets to add an array bounds check, causing local `clang` sanitizers (`compiler_run.ts`) to throw a runtime memory error during local testing.
3. **The Flag Trigger:** Instead of manually fixing the agent's behavior or re-prompting it endlessly, type `/flag "Failed to catch out-of-bounds array access in sensor loop"`.
4. **Trace Generation:** The `flag_failure.ts` skill triggers immediately. It pulls the last few conversational turns from `history.json`, truncates unnecessary noise, and writes an isolated execution log to `.pi/self_harness/traces/trace_20260622_1615.json`.

---

### Phase 2: Weakness Mining

A cron job or manual command launches the background optimization loop via `bun run .pi/self_harness/orchestrator.ts`.

1. **Trace Retrieval:** The `orchestrator.ts` script starts and calls `weakness_miner.ts`. The miner scans the `.pi/self_harness/traces/` directory for any new failure logs.
2. **Diagnostic Evaluation:** The miner reads the taxonomy rules inside `config/failure_taxonomy.json` and hands the trace to a localized instance of the model.
3. **Root Cause Diagnosis:** The model analyzes the trace and concludes: *"The agent failed because it attempted to parse raw pointer arithmetic without validating the buffer boundaries specified in the type definition."* It maps this failure to the taxonomy category `Unchecked Pointer Indexing`.

---

### Phase 3: Harness Proposal

With the weakness officially diagnosed, the engine shifts to finding a permanent, structural fix for the agent's prompt context.

1. **Candidate Engineering:** The orchestrator runs `proposer.ts`. It passes the miner's diagnosis, the `config/base_AGENTS.md` file, and the original failure trace back to the model.
2. **Targeted Rule Writing:** The model is explicitly instructed to generate a *minimal, high-leverage modification* to prevent this specific failure mode without bloating the system prompt.
3. **Staging the Fix:** The proposer writes out a proposed configuration change—such as appending a rule like `- When manipulating array indices derived from external telemetry streams, explicitly verify the index against the array capacity before assignment.`—and saves it to `.pi/self_harness/candidates/candidate_AGENTS.md`. If the weakness stems from a tooling limitation, the proposer may also output a modified TypeScript skill to .pi/self_harness/candidates/candidate_skills/ (e.g., adding a new static analysis flag to compiler_run.ts).

---

### Phase 4: Headless Sandbox Validation

The system never trusts a proposed rule change blindly. It must prove its worth against the regression suite.

1. **Environment Preparation:** The orchestrator executes `validator.ts`. The validator wipes `.pi/self_harness/sandbox/` and safely copies all contents of `benchmark/[TEST_DIRS]` into the sandbox to execute the test without altering the gold-standard benchmark files.
2. **Headless Execution:** The validator copies the benchmark assets (including test directories, e.g., `01_test_PID`) into the clean sandbox. It then launches a headless, non-interactive instance of the agent using the candidate prompt rules: `pi --mode json -p "benchmark/sandbox/01_test_PID/task_prompt.md"`
3. **Regression Testing:** The headless agent attempts to solve the benchmark tasks using the newly proposed `candidate_AGENTS.md`. The validator monitors the execution and triggers `benchmark/run_test_suite.sh`.
4. **Performance Comparison:** The script calculates the pass/fail metrics. To be promoted, the candidate harness must successfully pass the new safety test it previously failed *and* maintain a 100% pass rate on all other existing tests in the suite.

---

### Phase 5: Promotion & Audit Log

When validator.ts successfully passes a regression test and promotes a candidate to the live workspace, it must append an entry to self_harness/patch_history.json containing:

-The timestamp.  
-The diagnosed weakness (from the miner).  
-The exact diff applied.  
-The benchmark score improvement.  

1. **Live Deployment:** If the candidate passes validation, `validator.ts` replaces the workspace `AGENTS.md` with `candidate_AGENTS.md`.
2. **Aerospace Traceability:** The script appends a cryptographic-grade record to `.pi/self_harness/patch_history.json`:
* **Timestamp:** e.g., 2026-06-22 02:14:00
* **Mined Weakness:** e.g., Unchecked Pointer Indexing
* **Resolution:** e.g., Injected explicit bounds checking constraints for external streams.
* **Validation Status:** e.g., Passed (Suite Score: 14/14).


3. **Resume work**.