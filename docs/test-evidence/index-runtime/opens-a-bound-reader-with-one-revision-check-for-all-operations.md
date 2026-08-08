### Case INDEX-RUNTIME-READER-003: 以一次修订检查打开绑定 reader
Entry:
- `tools/index-runtime/tests/runtime.test.ts > opens a bound reader with one revision check for all operations`
- `bun test --test-name-pattern="^opens a bound reader with one revision check for all operations$" ./tools/index-runtime/tests/run.ts`
Contract:
- 打开 reader 时只检查一次结构化来源 revision，不执行完整 read、state parse、key derive 或 validate；随后 `all`、`get` 与 `query` 共享同一快照。
Proves:
- Open 后三类读取操作返回预期数据，revision 读取次数保持为一，其余领域投影调用保持为零。
- 非法 get ID 返回 `state-index.query-invalid`，不进入对象查找。
