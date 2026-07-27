### Case INDEX-RUNTIME-PROTOCOL-001: 排序键标量并比较有序键定义
Entry:
- `tools/index-runtime/tests/protocol.test.ts > orders key scalars and compares ordered key definitions`
- `bun test --test-name-pattern="^orders key scalars and compares ordered key definitions$" ./tools/index-runtime/tests/run.ts`
Contract:
- 键标量具有确定跨类型顺序，键定义相等性必须包含声明顺序与模式。
Proves:
- 布尔值、数值与文本按协议排序，重排或改动模式会使定义不相等。
