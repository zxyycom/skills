### Case DECISION-CANDIDATE-INDEX-001: 丢弃唯一候选不创建索引

Tests:
- `test:4d74f344658ca8e2d9b873bb6f8418565a66e9636011716748cfd9801e177a8e`

Tags:
- `decision-records`

Contract:
- 丢弃最后一条完整候选后，不存在任何 established record 时必须移除而非保留空的 decision-index。

Proves:
- discard 成功后候选文件与 decision-index 均不存在。
