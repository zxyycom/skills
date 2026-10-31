### Case DECISION-CLI-TAG-001: list rejects an invalid tag token

Tests:
- `test:34b0a339f1208a20d9e3577944fb28c323bfc67b1f40e27573413ca151db779e`

Tags:
- `decision-records`

Contract:
- `--tag` only accepts one kebab-case tag token.

Proves:
- An invalid tag exits with the CLI parameter error.
