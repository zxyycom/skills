### Case DECISION-STAGE-UNSELECTED-INVALID-001: Stage 隔离未选择的无效来源

Entry:
- `tools/decision-records/tests/stage.test.ts > stage isolates unselected invalid filesystem content from a selected revision ID`
- `bun test --test-name-pattern="^stage isolates unselected invalid filesystem content from a selected revision ID$" ./tools/decision-records/tests/run.ts`

Contract:
- 有 revision 时，未选择的非法 filesystem 内容不能阻断合法选择，也不能进入 pending；bootstrap 仍不放宽完整扫描。

Proves:
- 根目录中的非法 basename 保持未暂存，合法已修改 ID 和派生 index 正常进入 pending。
