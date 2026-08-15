### Case DECISION-LIFECYCLE-PREFLIGHT-001: 生命周期预写入拒绝来源漂移

Entry:
- `tools/decision-records/tests/lifecycle-relations.test.ts > lifecycle rejects a source changed after its prewrite scan before moving either path`
- `bun test --test-name-pattern="^lifecycle rejects a source changed after its prewrite scan before moving either path$" ./tools/decision-records/tests/run.ts`

Contract:
- 生命周期事务在预写入 scan 后必须核验来源仍未变化，避免移动或覆盖并发内容。

Proves:
- 来源改写后事务报错，原路径仍在、目标路径未创建、既有归档 index 不变。
