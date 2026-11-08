### Case INVESTIGATION-CLI-SELECTED-SYNC-001: 调查选择同步保留未选修订

Tests:
- `test:b57fb8c86345ac03e9f0f5bd132527c69b17a5974afa552b5ed24e5d8866437f`

Tags:
- `investigation-report`

Contract:
- 选择同步从可信发布索引更新所选来源，并保留未选来源修订。

Proves:
- 预检报告所选 checked ID 和 previewed；执行后未选正文虽变化，其完整索引状态与 source revision 仍等于基线。
- 同时选择旧 ID 和同路径的新 ID 后，旧 entry 消失、新 entry 的 sourcePath 保持 same.md，未选状态仍不变。
