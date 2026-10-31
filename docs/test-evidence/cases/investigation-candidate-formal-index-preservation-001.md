### Case INVESTIGATION-CANDIDATE-FORMAL-INDEX-PRESERVATION-001: 调查候选更名与删除不改正式索引

Tests:
- `test:0c439d1902004e3491d32623d180c4841e313c94295c960ea4e5f2e7c577c8b7`

Tags:
- `investigation-report`

Contract:
- 候选动作保留自身实际提交点，不为统一流程改写正式index。

Proves:
- 现存正式集合的合法CRLF索引mode0640保持；候选真实更名、旧位置退出，随后真实删除，新旧候选路径均不存在，index bytes、dev、inode、mode不变。
