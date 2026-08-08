### Case INDEX-RUNTIME-SERIALIZATION-001: 序列化保留定义字段与键顺序
Entry:
- `tools/index-runtime/tests/materialization.test.ts > preserves definition field and key order through serialization`
- `bun test --test-name-pattern="^preserves definition field and key order through serialization$" ./tools/index-runtime/tests/run.ts`
Contract:
- 定义顺序模式必须稳定控制顶层字段、键定义、状态字段和嵌套字段顺序；ID-keyed entries 继续使用确定性 ID 顺序。
Proves:
- 构建、序列化与解析按稳定 ID 顺序输出 entries 并保留声明字段顺序，重排键定义会被拒绝。
