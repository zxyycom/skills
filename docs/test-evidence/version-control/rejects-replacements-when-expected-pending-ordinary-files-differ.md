### Case VERSION-CONTROL-PENDING-EXPECTATION-001: 锁内核对期望 Pending 普通文件

Entry:
- `tools/shared/tests/version-control.test.ts > rejects replacements when expected pending ordinary files differ`
- `bun test --test-name-pattern="^rejects replacements when expected pending ordinary files differ$" ./tools/shared/tests/version-control.test.ts`

Contract:
- `replacePendingFiles` 传入 `expectedFiles` 时，必须在写入锁内且在任何目标写入前核对范围内普通文件的完整路径、字节和普通文件表示。

Proves:
- 字节不同、可执行文件、符号链接和未解决的同路径内容都返回 `pending-conflict`，不会进入 pending 写入 hook。
- 目标范围及范围外 pending 内容保持原样。
