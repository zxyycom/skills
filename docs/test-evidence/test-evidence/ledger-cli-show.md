### Case TEST-EVIDENCE-LEDGER-CLI-SHOW-001: Show CLI 以位置参数返回 Case 权威内容
Entry:
- `tools/test-evidence/tests/ledger-cli.test.ts > ledger CLI show accepts one positional Case ID and returns authority or absence`
- `bun test --test-name-pattern="^ledger CLI show accepts one positional Case ID and returns authority or absence$" ./tools/test-evidence/tests/run.ts`
Contract:
- `show <case-id>` 必须返回 Case Markdown 与当前 Test 详情，并结构化表示合法但不存在的 ID。
Proves:
- 已知 Case 成功返回两项 Test，不存在 Case 返回退出码 1 和 case-missing。
