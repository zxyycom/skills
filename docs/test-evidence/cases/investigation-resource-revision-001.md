### Case INVESTIGATION-RESOURCE-REVISION-001: resource byte changes do not change the report index source revision

Tests:
- `test:fed4491bac9a037ab05fa2c031fc29254b6127153d2342da02331fa7a2e69203`

Tags:
- `investigation-report`

Contract:
- 资源字节不进入报告 index source revision。

Proves:
- 真实资源内容变化后完整同步返回 unchanged 且 index 字节不变；引用资源被删除时同步拒绝且 index 不变。
