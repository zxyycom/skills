### Case INDEX-RUNTIME-NAMESPACE-001: 拒绝其他命名空间的持久化索引
Entry:
- `tools/index-runtime/tests/materialization.test.ts > rejects persisted indexes from another namespace`
- `bun test --test-name-pattern="^rejects persisted indexes from another namespace$" ./tools/index-runtime/tests/run.ts`
Contract:
- 持久化索引只能由匹配其命名空间和定义版本的消费者加载。
Proves:
- 相同文本在匹配命名空间下可解析，在不同命名空间下返回诊断。
