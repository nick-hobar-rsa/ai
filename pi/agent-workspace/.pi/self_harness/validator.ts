// Rigorously test the proposed harness on a benchmark suite to ensure it fixes the weakness without degrading existing capabilities (regression testing)
// This script will programmatically spin up a headless Pi instance (pi -p) using the candidate_AGENTS.md, run it against run_test_suite.sh in the benchmark/ folder, and compare the success rate to the baseline.
// If it passes, it copies the candidate over to the live AGENTS.md

// Ensure validator.ts treat candidates/ as a staging ground for both Markdown files (prompts) and TypeScript files (skills)