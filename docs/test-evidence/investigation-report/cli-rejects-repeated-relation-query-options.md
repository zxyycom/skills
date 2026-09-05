### Case INVESTIGATION-CLI-RELATION-FILTER-001: CLI rejects repeated relation query options

Entry:

- `tools/investigation-report/tests/cli-generated.test.ts > CLI rejects repeated relation query options`
- `bun test --test-name-pattern="^CLI rejects repeated relation query options$" ./tools/investigation-report/tests/run.ts`

Contract:

- `list` 与 `search` 的 `--related-to`、`--direction` 和 `--relation-type` 各只接受一次，重复参数不得被忽略或改变为无筛选查询。

Proves:

- 两个命令对每个重复关系查询参数返回参数错误、退出码 `2` 且不写 stdout。
