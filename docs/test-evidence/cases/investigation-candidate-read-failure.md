### Case INVESTIGATION-CANDIDATE-READ-FAILURE-001: 候选准备失败保持只读诊断边界

Tests:
- `test:63091a8548ca9ad8fb4671f88f51a80d9a3618ca87884fdeb2bdd16509f67b03`

Tags:
- `investigation-report`

Contract:
- 候选读取的可预期故障返回读取诊断与恢复动作，不映射为创建事务或 mutation 结果。

Proves:
- candidates 与 show-candidate 的资源访问准备失败返回 candidate-read-failed、access-denied 和读取重试动作，不附 mutation；候选正文保持不变。
