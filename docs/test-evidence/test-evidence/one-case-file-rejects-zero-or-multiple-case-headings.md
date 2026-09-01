### Case TEST-EVIDENCE-CASE-FILE-CARDINALITY-001: 单 Case 文件拒绝零个或多个 Case

Entry:
- `tools/test-evidence/tests/catalog.test.ts > one case file rejects zero or multiple case headings`
- `bun test --test-name-pattern="^one case file rejects zero or multiple case headings$" ./tools/test-evidence/tests/catalog.test.ts`

Contract:
- 每个 `<topic>/<slug>.md` 必须且只能包含一个 fenced code block 外的 `### Case` 标题。

Proves:
- 没有 case 标题或包含两个 case 标题的文件都被目录校验拒绝。
