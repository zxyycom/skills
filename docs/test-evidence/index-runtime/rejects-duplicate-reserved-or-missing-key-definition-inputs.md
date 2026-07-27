### Case INDEX-RUNTIME-DEFINITION-002: 拒绝重复保留或缺失的定义输入
Entry:
- `tools/index-runtime/tests/protocol.test.ts > rejects duplicate, reserved, or missing key definition inputs`
- `bun test --test-name-pattern="^rejects duplicate, reserved, or missing key definition inputs$" ./tools/index-runtime/tests/run.ts`
Contract:
- 定义必须拥有唯一非保留键名和有效状态解析器。
Proves:
- 重复键、保留 `id` 键与缺失 `parseState` 均在定义阶段失败。
