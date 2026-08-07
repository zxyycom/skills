### Case TASK-GRAPH-CLI-PROTOCOL-001: 每次调用只写一个 LF 结尾 JSON

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI help, version, and usage stay inside the single-JSON LF protocol`
- `bun test --test-name-pattern="^CLI help, version, and usage stay inside the single-JSON LF protocol$" ./tools/task-graph/tests/run.ts`

Contract:
- help、version 与 usage 属于 JSON-only CLI 协议并遵守统一退出码；每个规范命令都必须有可查询的结构化 usage、positionals、options、类型、必填性、重复性、枚举、默认值或 stdin/file 输入说明。

Proves:
- 根 help 枚举全部 35 个命令并逐一查询成功，机器可读地公布固定 Node range、mutation runtime 前置以及安装命令；scope create 与 apply 的复杂参数和 stdin/file 默认输入可恢复，每次调用只写一个 LF 结尾 JSON。
