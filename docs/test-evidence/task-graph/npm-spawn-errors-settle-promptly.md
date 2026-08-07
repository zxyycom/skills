### Case TASK-GRAPH-RUNTIME-SPAWN-001: npm spawn error 及时结算

Entry:
- `tools/task-graph/tests/runtime.test.ts > npm command spawn errors reject promptly and clear process resources`
- `bun test --test-name-pattern="^npm command spawn errors reject promptly and clear process resources$" ./tools/task-graph/tests/run.ts`

Contract:
- 子进程启动失败不得遗留超时器、监听器或等待完整安装期限。

Proves:
- 不存在的命令在两秒内拒绝，而不是等待十秒测试超时。
