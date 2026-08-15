### Case DECISION-METADATA-REMOVED-001: 拒绝移除领域字段与未知 frontmatter

Entry:
- `tools/decision-records/tests/metadata.test.ts > decision Markdown rejects removed domain fields and unknown frontmatter`
- `bun test --test-name-pattern="^decision Markdown rejects removed domain fields and unknown frontmatter$" ./tools/decision-records/tests/run.ts`

Contract:
- 当前 frontmatter 只接受定义字段；已移除的 domain/domains 及未知字段必须失败。

Proves:
- 对 domain、domains、extra 三种字段均产生验证错误。
