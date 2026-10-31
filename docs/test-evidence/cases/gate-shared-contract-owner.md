### Case GATE-SHARED-CONTRACT-OWNER-001: 共同 reader 与事务拥有独立测试消费

Tests:
- `test:785ffaafc5c1b4333c7101bae11c66d758910c14c0fdfdd3c56353d1c4035cff`

Tags:
- `repository-tooling`

Contract:
- 共同证明由独立 shared-contract Check 消费共同测试 leaf与两域 worker 分发输入，不重复挂域生命周期。

Proves:
- 共同测试与任一域生成 worker 改动使 shared-contract 执行，域 sibling lifecycle/transaction 可复用，生成前置按实际分发责任接线。
