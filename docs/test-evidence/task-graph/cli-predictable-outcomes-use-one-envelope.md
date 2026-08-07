### Case TASK-GRAPH-CLI-ERRORS-001: 各结果保持单 JSON、稳定 error code、retryable 与可读取 revision

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI success and predictable schema, state, conflict, and file failures use one envelope`
- `bun test --test-name-pattern="^CLI success and predictable schema, state, conflict, and file failures use one envelope$" ./tools/task-graph/tests/run.ts`

Contract:
- CLI 成功及可预期 schema、状态、revision 与文件错误使用统一 envelope；Map/null-prototype 解析不得把保留字或原型属性误当作已有选项或实体。非 runtime 失败可以尽力读取 revision；runtime 命令和 `RUNTIME_*` 失败禁止读取工作区，且绝不重放 mutation。

Proves:
- 合法 binding/reference 可创建和查询，持久字典保留字稳定拒绝，外部非法 ID 返回明确 not-found；unknown outcome 不可读时 revision 为 null 并保留 possible revision；各结果保持单 JSON、稳定 error code 与 retryable。
