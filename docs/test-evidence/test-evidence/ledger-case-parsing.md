### Case TEST-EVIDENCE-LEDGER-CASE-PARSE-001: Case 来源支持多 Test 与可选 Tag
Entry:
- `tools/test-evidence/tests/ledger-source.test.ts > case sources parse canonical multi-test cases with optional tags`
- `bun test --test-name-pattern="^case sources parse canonical multi-test cases with optional tags$" ./tools/test-evidence/tests/run.ts`
Contract:
- Case Markdown 必须恢复有序多 Test 关系，并允许 Tag 段整体省略。
Proves:
- 零、一或多个 Tag 的合法 Case 都形成规范化数据，缺失和显式空的 `cases/` 都表示零 Case。
