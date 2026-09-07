### Case DECISION-RELATION-SUMMARY-001: Relation summary normalization preserves the Unicode boundary

Tests:
- `test:a12b5236157f17f2f964acb7434ceacfe7febb9cdeb6410e950a11ff6b763f7e`

Tags:
- `decision-records`

Contract:
- Relation summary input trims whitespace, omits blank values, permits at most 40 Unicode code points, and rejects physical line breaks without truncation.

Proves:
- Blank input, including whitespace around a physical line break, is omitted before line validation; a trimmed value retains text after the first CLI separator.
- Forty astral Unicode code points pass, while forty-one and multiline input fail.
