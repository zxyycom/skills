### Case TEST-EVIDENCE-REVISION-CASE-MOVE-001: Case 移动只改变自身 Entry Revision 并保留身份

Entry:
- `tools/test-evidence/tests/catalog.test.ts > case moves change only their entry revision and preserve identity`
- `bun test --test-name-pattern="^case moves change only their entry revision and preserve identity$" ./tools/test-evidence/tests/catalog.test.ts`

Contract:
- Case revision 必须包含源路径，而 Case ID 作为 record key 不随合法移动改变；topic 表未变时 metadata revision 也不得改变。

Proves:
- 将 access case 移入 `sessions` 并同步后，metadata revision 不变，只有该 case 的 entry revision 改变，另一个 case 的 entry revision 保持不变。
- `show` 仍以原 Case ID 返回移动后的 `sessions/access-role.md` 与 `sessions` topic。
