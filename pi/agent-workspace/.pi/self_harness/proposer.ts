// Generate a candidate harness modification (a prompt tweak or a tool wrapper edit) based on the mined weakness
// takes the output from the miner, reads base_AGENTS.md, and generates a temporary candidate_AGENTS.md. It must not overwrite your live AGENTS.md yet

// proposer.ts prompt must be instructed to condense, merge, or replace existing rules rather than blindly appending to the file.