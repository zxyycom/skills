### Case INVESTIGATION-CANDIDATE-FORMAL-INDEX-PRESERVATION-001: 调查候选更名与删除不改正式索引

Tests:
- `test:f108b29c48950314d0a9d4c50c4c1bfcf78249ddf8dfc513c84d29bdc52f3d1a`

Tags:
- `investigation-report`

Contract:
- 候选动作保留自身实际提交点，不为统一流程改写正式index。

Proves:
- 现存正式集合的合法CRLF索引mode0640保持；候选真实更名、旧位置退出，随后真实删除，新旧候选路径均不存在，index bytes、dev、inode、mode不变。
