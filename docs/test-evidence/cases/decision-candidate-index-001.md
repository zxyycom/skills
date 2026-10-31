### Case DECISION-CANDIDATE-INDEX-001: 丢弃唯一候选不创建索引

Tests:
- `test:a3ea8c9a3a7aac6f09d16bd8afe837d722ffea6b49966ec20bec1c787b5c5ef0`

Tags:
- `decision-records`

Contract:
- 丢弃最后一条完整候选后，不存在任何 established record 时必须移除而非保留空的 decision-index。

Proves:
- discard 成功后候选文件与 decision-index 均不存在。
