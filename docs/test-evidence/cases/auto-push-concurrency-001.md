### Case AUTO-PUSH-CONCURRENCY-001: 并发调用共享同一小时窗口

Tests:
- `test:d63a88da82a3d1b3dcd9d318db1d7595cd30f0e62907b65fde77e2407f2a53a8`

Tags:
- `repository-tooling`

Contract:
- 同一 Git common dir 中的并发 helper 必须通过节流 ref 的 compare-and-swap 共享滚动一小时窗口，不能各自保留推送尝试。

Proves:
- 两个并发 helper 都正常结算，但只有一个报告已推送，隔离 bare remote 最终指向预期本地 main revision。
