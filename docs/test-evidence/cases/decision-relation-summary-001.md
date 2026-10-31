### Case DECISION-RELATION-SUMMARY-001: Relation summary normalization preserves the Unicode boundary

Tests:
- `test:ad7dc17dc2a5018a5ec16bebdfc941537952ea1c57d5e8c803e2634d36f9b196`

Tags:
- `decision-records`

Contract:
- Relation summary input trims whitespace, omits blank values, permits at most 40 Unicode code points, and rejects physical line breaks without truncation.

Proves:
- Blank input, including whitespace around a physical line break, is omitted before line validation; a trimmed value retains text after the first CLI separator.
- Forty astral Unicode code points pass, while forty-one and multiline input fail.
