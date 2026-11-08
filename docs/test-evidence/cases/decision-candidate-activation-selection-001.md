### Case DECISION-CANDIDATE-ACTIVATION-SELECTION-001: 发布所选候选隔离未选损坏正文

Tests:
- `test:63f984d4806f46c791f3521793bbd9e41aa229b95d9e60ed8a9a7929c32f2324`

Tags:
- `decision-records`

Contract:
- 发布所选候选不应受未选候选正文损坏阻断。

Proves:
- 所选候选预检不写来源或索引，实际发布成功且未选非法 UTF-8 来源字节保持；索引保存所选来源 revision。
