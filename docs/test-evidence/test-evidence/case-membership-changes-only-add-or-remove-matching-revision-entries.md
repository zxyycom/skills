### Case TEST-EVIDENCE-REVISION-MEMBERSHIP-001: Case 成员变化只增删对应 Revision Entry

Entry:
- `tools/test-evidence/tests/catalog.test.ts > case membership changes only add or remove matching revision entries`
- `bun test --test-name-pattern="^case membership changes only add or remove matching revision entries$" ./tools/test-evidence/tests/catalog.test.ts`

Contract:
- `sourceRevision.entries` 必须与 case state record 使用相同 ID 集合，成员增删不得改写无关来源指纹。

Proves:
- 新增合法 case 只增加对应 ID，删除另一个 case 只移除对应 ID；metadata 与保留 case 指纹均保持不变。
