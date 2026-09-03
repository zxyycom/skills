### Case MCPSHELL-BRIDGE-INIT-008: initializer recovers registration from a complete existing environment

Entry:
- `tools/mcpshell-workspace-bridge/tests/initializer.test.ts > initializer recovers registration from a complete existing environment`
- `bun test --test-name-pattern="^initializer recovers registration from a complete existing environment$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- preview/apply 省略全部 config flags 时只能复用完整且有效的本机 env；env action 保持 `unchanged`，并可恢复缺失的受管 registration。

Proves:
- 缺失或不完整的 env 返回 `config_invalid`，不创建 registration，也不改写已有无效 env。
- 有效 env 的 preview 只计划创建 registration，结果不回显 project root。
- apply 保留 env 字节并写入受管 registration。
