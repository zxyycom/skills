### Case TASK-GRAPH-CLI-ERRORS-001: 各结果保持单 JSON、稳定 error code、retryable 与可读取 revision

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI success and predictable schema, state, conflict, and file failures use one envelope`
- `bun test --test-name-pattern="^CLI success and predictable schema, state, conflict, and file failures use one envelope$" ./tools/task-graph/tests/run.ts`

Contract:
- CLI 成功及可预期 schema、状态、revision 与文件错误使用统一 envelope；Map/null-prototype 解析不得把保留字或原型属性误当作已有选项或实体。所有协议内失败都 best-effort 重读当前 revision，包括 `WRITE_OUTCOME_UNKNOWN`，且绝不重放 mutation。

Proves:
- 合法 binding/reference 可创建和查询，持久字典中的 `constructor`、`prototype`、`__proto__` 稳定拒绝，外部 scope/task ID `constructor` 返回明确 not-found；已提交且可读的 unknown outcome 返回 revision 1，不可读时返回 null，两者保留 possible revision；各结果保持单 JSON、稳定 error code 与 retryable。
