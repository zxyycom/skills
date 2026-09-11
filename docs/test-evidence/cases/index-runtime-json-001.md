### Case INDEX-RUNTIME-JSON-001: 拒绝非 JSON 状态与解析器输出

Tests:
- `test:8c2886182780058fff30a1f5d296bb6cbd9cfba490dd0eed566ff7fa2fa8a268`

Tags:
- `index-runtime`

Contract:
- 原始状态、状态解析结果与元数据解析结果都必须可表示为 JSON。

Proves:
- `NaN` 与 `Date` 投影分别触发状态、状态解析和元数据解析诊断。
