### Case TEST-EVIDENCE-SELECTED-SYNC-001: selected sync accepts one Case change only after proving the full catalog

Entry:
- `tools/test-evidence/tests/catalog.test.ts > selected sync accepts one Case change only after proving the full catalog`
- `bun test --test-name-pattern="^selected sync accepts one Case change only after proving the full catalog$" ./tools/test-evidence/tests/catalog.test.ts`

Contract:
- Test Evidence selected sync 只接受精确 Case ID，仍完整验证 catalog，且 topic metadata 变化必须使用 full sync。

Proves:
- 未选择 Case 变化零写入失败；selected JSON check/write 返回按输入顺序的 selectors、scope 与 selected IDs，文本输出同时说明 selector 和 resolved ID。
- topic metadata 变化返回 collection-changed，不能按 Case selected scope 发布。
