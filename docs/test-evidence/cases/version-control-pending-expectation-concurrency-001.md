### Case VERSION-CONTROL-PENDING-EXPECTATION-CONCURRENCY-001: 期望文件串行化并发 Pending 替换

Tests:
- `test:e47fa9bdf3579757b4d7423b398b4c64ce45f61a96f1c099a2f4b2e01bc7149d`

Tags:
- `version-control`

Contract:
- 两个从同一 pending 文件期望开始的并发范围替换不能互相覆盖。

Proves:
- 并发替换恰有一个成功，另一个以稳定 `pending-conflict` 失败。
- 最终 pending 文件逐字节等于唯一获胜目标。
