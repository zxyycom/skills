### Case TASK-GRAPH-GITIGNORE-CRLF-001: init 保留局部 ignore 的 CRLF 与既有顺序

Entry:
- `tools/task-graph/tests/store.test.ts > index init appends the local ignore rule without changing existing CRLF content or order`
- `bun test --test-name-pattern="^index init appends the local ignore rule without changing existing CRLF content or order$" ./tools/task-graph/tests/run.ts`

Contract:
- 首次 init 在锁文件前幂等维护局部 `.gitignore`，只追加固定注释和规则。

Proves:
- 既有 CRLF 字节和规则顺序不变，新增规则沿用 CRLF，随后稳定锁文件为普通文件。
