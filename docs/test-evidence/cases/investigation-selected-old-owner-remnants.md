### Case INVESTIGATION-SELECTED-OLD-OWNER-REMNANTS-001: 选择同步拒绝仍存在的旧 owner

Tests:
- `test:b57fb8c86345ac03e9f0f5bd132527c69b17a5974afa552b5ed24e5d8866437f`

Tags:
- `investigation-report`

Contract:
- 选中报告删除时，已知旧 owner 目录存在不得更新索引为已删除。

Proves:
- 旧 owner 目录存在时预检返回 resource-owner-present；移除目录后执行成功。
