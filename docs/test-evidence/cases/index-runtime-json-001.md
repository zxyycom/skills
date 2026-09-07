### Case INDEX-RUNTIME-JSON-001: 拒绝非 JSON 状态与解析器输出

Tests:
- `test:ace6890ac34639bdb3de2abe93ec08e164f5c37e35100e627014e8cb19315a1c`

Tags:
- `index-runtime`

Contract:
- 原始状态、状态解析结果与元数据解析结果都必须可表示为 JSON。

Proves:
- `NaN` 与 `Date` 投影分别触发状态、状态解析和元数据解析诊断。
