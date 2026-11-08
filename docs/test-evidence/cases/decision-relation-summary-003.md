### Case DECISION-RELATION-SUMMARY-003: New binds a summary after selector resolution

Tests:
- `test:41aa45138aa39be3212f03df6301535766ab5eae796833cbcbbfa9a93c9251d9`
- `test:f754be834cb65b05e14d5fe9f01e5dc01c2258895b6d098d0d7d0cec7642c443`
- `test:f8264139cd816e115baaf81969b5f1e6098c8a23af887c6c0057554b428f4799`

Tags:
- `decision-records`

Contract:
- `new --relation-summary <target-selector=summary>` uses the same ID-first target resolution as `--relation`, then writes only the trimmed summary on that relation.

Proves:
- 真实 Decision CLI `new` 通过关系参数写入 trim 后摘要；原生 Decision 关系事务验证 name 与完整 ID 可指向同一 target、不同 ID 被拒绝。
- 共用的 new 关系参数解析与转换路径由真实 Investigation CLI 验证：name 与完整 ID 指向同一目标，摘要保留第一个等号后的文本。此为共享层与 Decision 接线的组合证据，不声称逐字验证 Decision 输出的完整关系字段顺序。
