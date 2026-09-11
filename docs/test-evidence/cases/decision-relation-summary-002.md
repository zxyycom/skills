### Case DECISION-RELATION-SUMMARY-002: Activate binds a CLI summary to its complete relation set

Tests:
- `test:4c2e0ab02333845e3d92d041b19131e8fe44cfc4a2b88647bcba4a93be07d1be`

Tags:
- `decision-records`

Contract:
- `activate --relation-summary <target-selector=summary>` binds only to a target in the same complete relation replacement after ID-first selector resolution; the summary is trimmed and is projected by the index and trace entry relations.

Proves:
- A target selector resolves to the established Decision ID, retains content after the first `=`, and writes the canonical relation summary to the index.
- Trace JSON entry relations display the stored summary.
