### Case DECISION-TRANSACTION-READONLY-PREFLIGHT-001: 事务预检不持写锁且不写领域文件

Tests:
- `test:eacc3e8245b65bbc0fbeb60c850af5579af87b7fd6f306d45e027de4688a5ec2`

Tags:
- `decision-records`

Contract:
- 生命周期预检只验证完整当前输入，不取得写锁或保存执行凭据。

Proves:
- 合作锁已存在时合法 set-relations 预检通过且来源、索引、锁原字节保持；相关来源漂移时以同步前提失败而非 lock-busy 拒绝。
