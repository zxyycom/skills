### Case INDEX-RUNTIME-JSON-001: 拒绝非 JSON 状态与解析器输出

Tests:
- `test:2a3169d7cb2c6f17707f8085b9c2787f6aecdb946e4f5c8ac7279647e7899aaf`

Tags:
- `index-runtime`

Contract:
- 原始状态、状态解析结果与元数据解析结果都必须可表示为 JSON。

Proves:
- `NaN` 与 `Date` 投影分别触发状态、状态解析和元数据解析诊断。
