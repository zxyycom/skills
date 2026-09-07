### Case DECISION-CLI-TAG-001: list rejects an invalid tag token

Tests:
- `test:90f1d610b89f4599645c788a974b456f064f3d3cf807025f0927e5e959c0206e`

Tags:
- `decision-records`

Contract:
- `--tag` only accepts one kebab-case tag token.

Proves:
- An invalid tag exits with the CLI parameter error.
