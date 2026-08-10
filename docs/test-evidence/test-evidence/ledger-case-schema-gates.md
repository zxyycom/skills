### Case TEST-EVIDENCE-LEDGER-CASE-SCHEMA-001: Case 来源拒绝非规范标题与分段
Entry:
- `tools/test-evidence/tests/ledger-source.test.ts > case sources reject invalid headings sections tests tags and paths`
- `bun test --test-name-pattern="^case sources reject invalid headings sections tests tags and paths$" ./tools/test-evidence/tests/run.ts`
Contract:
- Case 文件必须满足有效 UTF-8、首行标题、固定段序、有序唯一 Test 与 Tag、无多余正文和语义文件名约束。
Proves:
- 每类损坏编码或违反 Case 语法、路径、全局 Case ID 唯一性规则的来源都不能形成可用账本或派生索引。
