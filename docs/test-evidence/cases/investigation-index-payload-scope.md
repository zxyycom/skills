### Case IR-INDEX-PAYLOAD-SCOPE-001: index仅验收索引payload而完整范围不降级

Tests:
- `test:e74e3595576527217b56f96ced4c8b6b8ea21eb4e4bc28f91824d0de9af6e904`

Tags:
- `investigation-report`

Contract:
- IR index scope仅消费并验收pending索引payload，全域成员路径、模式与OID身份仍受保护；all/domain维持完整payload可读性验收。

Proves:
- 非索引对象缺失时 all/domain 在 pending 读取处失败且不改 index；index仍只更新选中索引投影，未选条目保持，重复选择unchanged。
