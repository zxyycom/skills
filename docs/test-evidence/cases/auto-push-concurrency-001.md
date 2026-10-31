### Case AUTO-PUSH-CONCURRENCY-001: 并发调用共享同一小时窗口

Tests:
- `test:0eb540e515c515a207ef31c0ddbe0d9c35bb5d35e493d43a4fc136f9a6f79c5c`

Tags:
- `repository-tooling`

Contract:
- 同一 Git common dir 中的并发 helper 必须通过节流 ref 的 compare-and-swap 共享滚动一小时窗口，不能各自保留推送尝试。

Proves:
- 两个并发 helper 都正常结算，但只有一个报告已推送，隔离 bare remote 最终指向预期本地 main revision。
