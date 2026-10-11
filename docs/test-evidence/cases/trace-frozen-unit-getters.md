### Case GRAPH-TRACE-ACCESSOR-001: 冻结单位的 getter 按扩展取得快照

Tests:
- `test:33177fcd3a96dbf281f5896f672fba665df3a1c74c0357dd810f967baeb028e3`

Tags:
- `performance`
- `semantic-fidelity`

Contract:
- 冻结 unit 的 traceIds getter 不构成稳定值证明，adapter 的新快照必须仍被观察。

Proves:
- 后续 getter 返回新的冻结目标数组时，b 被提升为 trace，context 清空且 coverage 完整。
