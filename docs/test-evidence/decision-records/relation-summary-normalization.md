### Case DECISION-RELATION-SUMMARY-001: Relation summary normalization preserves the Unicode boundary

Entry:
- `tools/decision-records/tests/relation-validation.test.ts > relation summaries normalize blank input and enforce the Unicode single-line boundary`
- `bun test --test-name-pattern="^relation summaries normalize blank input and enforce the Unicode single-line boundary$" ./tools/decision-records/tests/run.ts`

Contract:
- Relation summary input trims whitespace, omits blank values, permits at most 40 Unicode code points, and rejects physical line breaks without truncation.

Proves:
- Blank input, including whitespace around a physical line break, is omitted before line validation; a trimmed value retains text after the first CLI separator.
- Forty astral Unicode code points pass, while forty-one and multiline input fail.
