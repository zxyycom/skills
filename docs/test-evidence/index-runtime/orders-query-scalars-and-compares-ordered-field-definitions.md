### Case INDEX-RUNTIME-PROTOCOL-001: 排序查询标量并比较有序字段定义
Entry:
- `tools/index-runtime/tests/protocol.test.ts > orders query scalars and compares ordered field definitions`
- `bun test --test-name-pattern="^orders query scalars and compares ordered field definitions$" ./tools/index-runtime/tests/run.ts`
Contract:
- 查询标量具有确定的跨类型顺序；definition-owned 字段定义的相等性包含声明顺序与 mode。
Proves:
- 布尔值、数值与文本按协议排序，字段重排或 mode 改动会使定义不相等。
