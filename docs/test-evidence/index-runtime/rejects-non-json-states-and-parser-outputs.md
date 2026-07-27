### Case INDEX-RUNTIME-JSON-001: 拒绝非 JSON 状态与解析器输出
Entry:
- `tools/index-runtime/tests/protocol.test.ts > rejects non-JSON states and parser outputs`
- `bun test --test-name-pattern="^rejects non-JSON states and parser outputs$" ./tools/index-runtime/tests/run.ts`
Contract:
- 原始状态、状态解析结果与元数据解析结果都必须可表示为 JSON。
Proves:
- `NaN` 与 `Date` 投影分别触发状态、状态解析和元数据解析诊断。
