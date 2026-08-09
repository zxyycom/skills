### Case VERSION-CONTROL-PENDING-EXPECTATION-CONCURRENCY-001: 期望文件串行化并发 Pending 替换

Entry:
- `tools/shared/tests/version-control.test.ts > serializes concurrent replacements against expected pending files`
- `bun test --test-name-pattern="^serializes concurrent replacements against expected pending files$" ./tools/shared/tests/version-control.test.ts`

Contract:
- 两个从同一 pending 文件期望开始的并发范围替换不能互相覆盖。

Proves:
- 并发替换恰有一个成功，另一个以稳定 `pending-conflict` 失败。
- 最终 pending 文件逐字节等于唯一获胜目标。
