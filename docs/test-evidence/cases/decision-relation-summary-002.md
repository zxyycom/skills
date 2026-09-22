### Case DECISION-RELATION-SUMMARY-002: Evolve binds a CLI summary to its complete relation set

Tests:
- `test:918761b2385aa0a5fce8492d5eabee995ad85e2d18ea97b0d59410cca4bb475f`

Tags:
- `decision-records`

Contract:
- `evolve --relation-summary <target-selector=summary>` binds only to a target in the same complete relation replacement after ID-first selector resolution; the summary is trimmed and is projected by the index and trace entry relations.

Proves:
- A target selector resolves to the established Decision ID, retains content after the first `=`, and writes the canonical relation summary to the index.
- Trace JSON entry relations display the stored summary.
