### Case VERSION-CONTROL-PENDING-CONFLICT-001: 拒绝陈旧 pending 替换且保持文件

Entry:
- `tools/shared/tests/version-control.test.ts > rejects stale pending replacements without changing pending files`
- `bun test --test-name-pattern="^rejects stale pending replacements without changing pending files$" ./tools/shared/tests/version-control.test.ts`

Contract:
- pending 范围替换只接受仍为当前值的 expected revision，并在无法独占当前 pending 更新前提时以稳定冲突语义要求调用方重新读取后重试。

Proves:
- expected revision 已变化或当前 pending 更新前提不可用时均返回 `pending-conflict`，诊断要求从当前 revision 重试且不泄漏底层实现值。
- 每次冲突后完整 pending 文件集合与调用前一致。
