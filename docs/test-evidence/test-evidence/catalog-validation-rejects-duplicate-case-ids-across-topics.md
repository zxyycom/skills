### Case TEST-EVIDENCE-CROSS-TOPIC-ID-001: Case ID 在全部 Topic 中唯一

Entry:
- `tools/test-evidence/tests/catalog.test.ts > full and fast source reads reject duplicate case IDs across topics`
- `bun test --test-name-pattern="^full and fast source reads reject duplicate case IDs across topics$" ./tools/test-evidence/tests/catalog.test.ts`

Contract:
- 完整 catalog 读取与快速 revision 读取都必须在全部受控 topic 中唯一解析每个 Case ID；重复身份不得覆盖先读来源。

Proves:
- 两个 topic 声明相同 ID 时返回包含双方 `<topic>/<slug>.md` 源路径的 `catalog.case-id-duplicate` 诊断。
- 快速 revision 读取也拒绝重复 case ID，不会由后读来源覆盖先读成员。
