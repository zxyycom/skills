### Case DECISION-CLI-TAG-001: list rejects an invalid tag token

Entry:
- `tools/decision-records/tests/cli-args.test.ts > list rejects an invalid tag token`

Contract:
- `--tag` only accepts one kebab-case tag token.

Proves:
- An invalid tag exits with the CLI parameter error.
