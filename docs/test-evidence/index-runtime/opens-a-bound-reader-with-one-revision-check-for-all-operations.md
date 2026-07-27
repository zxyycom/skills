### Case INDEX-RUNTIME-READER-003: 以一次修订检查打开绑定 reader
Entry:
- `tools/index-runtime/tests/runtime.test.ts > opens a bound reader with one revision check for all operations`
- `bun test --test-name-pattern="^opens a bound reader with one revision check for all operations$" ./tools/index-runtime/tests/run.ts`
Contract:
- 打开 reader 时检查一次新鲜度，随后 `all`、`get` 与 `query` 共享同一快照。
Proves:
- 三类读取操作返回预期数据且修订读取次数保持为一。
