### Case DECISION-CLI-TAG-001: list rejects an invalid tag token

Tests:
- `test:ddaef25cf4e923b2b75241ea75d9583d0d11e7f3a2c66cd915a30ac3e1f3e04e`

Tags:
- `decision-records`

Contract:
- `--tag` only accepts one kebab-case tag token.

Proves:
- An invalid tag exits with the CLI parameter error.
