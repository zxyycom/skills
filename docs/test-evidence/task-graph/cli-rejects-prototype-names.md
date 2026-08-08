### Case TASK-GRAPH-CLI-PROTOTYPE-001: Prototype-like command 和 option 被拒绝

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI rejects prototype-like command and option names`
- `bun test --test-name-pattern="^CLI rejects prototype-like command and option names$" ./tools/task-graph/tests/run.ts`

Contract:
- CLI catalog 与 option lookup 不得从对象原型继承伪 command 或伪 option。

Proves:
- help constructor 与 --constructor 都返回 ARGUMENT_INVALID JSON。
