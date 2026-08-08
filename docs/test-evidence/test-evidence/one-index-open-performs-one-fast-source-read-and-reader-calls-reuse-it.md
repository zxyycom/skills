### Case TEST-EVIDENCE-FAST-OPEN-001: 一次 Open 只读取一次快速来源并由 Reader 复用

Entry:
- `tools/test-evidence/tests/run.ts > one index open performs one fast source read and reader calls reuse it`
- `bun test --test-name-pattern="^one index open performs one fast source read and reader calls reuse it$" ./tools/test-evidence/tests/run.ts`

Contract:
- 打开 test-evidence 索引只执行一次快速 revision 读取；绑定 reader 的后续操作不得重新读取来源或执行完整领域投影。

Proves:
- `open` 的计数为一次 `readRevision`、零 `read`、state parse、key derive 和完整验证。
- 权威来源在打开后移走，`get`、`query` 与 `all` 仍复用已绑定快照且计数不变。
