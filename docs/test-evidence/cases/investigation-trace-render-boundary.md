### Case IR-TRACE-BOUNDARY-001: 终端事件与预算边界文本保持完整

Tests:
- `test:e0d82d18735dfac833cd1c36272afb01b251d7be159a734bd636ea398436cc6e`

Tags:
- `performance`
- `semantic-fidelity`

Contract:
- renderer 只消费同一查询切片，不改变 trace/context 成员、frontier 或完整 blockedEvent。

Proves:
- 完整文本独立期待保留拆分 trace/context 标记、事件成员次序、frontier 与完整 blocked-event records/required-max-records。
