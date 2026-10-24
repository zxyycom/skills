### Case DECISION-SELECTED-SYNC-001: 所选 Decision 同步验证必要依赖并发布局部变化

Tests:
- `test:21096b6d46fc4ff80a8124aa52b786e1a5021d6c4aec916ccf1a93e26f7a2bda`

Tags:
- `decision-records`

Contract:
- Decision `sync-index --select` 在合法发布基线上验证所选已知路径与必要依赖，只接纳所选变化并验完整组合图；`--preflight` 同范围只读预演。

Proves:
- 作为必要依赖的未选 Decision 发生变化时零写入失败；唯一 name 加 `.md` 的 selected preflight 成功并明确尚未发布，baseline 字节不变。
- selected 文本结果同时保留原始 `.md` selector 与解析后的 ID，且其完整索引字节与同一来源的 full sync 相同。
