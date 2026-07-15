// wraps run_test.sh script(s) to feed stderr back to model
// run_test.sh inside the PID test case should explicitly call this skill.
// If Pi generates code that breaks compilation or fails the structural checks specified in your Class D requirements, the bash script can instantly catch the failure and return exit code 1 to validator.ts
