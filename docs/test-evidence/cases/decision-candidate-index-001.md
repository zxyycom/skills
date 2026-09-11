### Case DECISION-CANDIDATE-INDEX-001: 丢弃唯一候选不创建索引

Tests:
- `test:9406398c6739ce7155e3f95de13c9015bbf890131c012bca644ae7abc145c5ce`

Tags:
- `decision-records`

Contract:
- 丢弃最后一条完整候选后，不存在任何 established record 时必须移除而非保留空的 decision-index。

Proves:
- discard 成功后候选文件与 decision-index 均不存在。
