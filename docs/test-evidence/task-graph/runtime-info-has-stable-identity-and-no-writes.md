### Case TASK-GRAPH-RUNTIME-INFO-001: runtime info 的身份稳定且没有写副作用

Entry:
- `tools/task-graph/tests/runtime.test.ts > runtime info uses deterministic text identity, default and environment homes, and no writes`
- `bun test --test-name-pattern="^runtime info uses deterministic text identity, default and environment homes, and no writes$" ./tools/task-graph/tests/run.ts`

Contract:
- Runtime ID 由 lockfile 语义内容确定，默认目录与环境覆盖稳定，info 只读。

Proves:
- LF/CRLF 资产得到同一 ID，空环境使用默认 home，非空覆盖完整生效，两个 home 都未被创建。
