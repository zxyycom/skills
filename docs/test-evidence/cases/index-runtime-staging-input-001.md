### Case INDEX-RUNTIME-STAGING-INPUT-001: 注入仓储前稳定拒绝非法暂存输入

Tests:
- `test:f04d27036b95e5e56785c4ff6aabadfe21bc7d19477511c00f7dbd01c9339fb4`

Tags:
- `index-runtime`

Contract:
- 索引路径必须留在配置根目录内；`selectedIds` 必须是非空、合法且不重复的稳定 ID 集合，每个 ID 必须至少存在于 revision 或工作区索引之一。

Proves:
- 空集合、重复 ID、非法文本、不存在的 ID 和非字符串运行时输入都返回 `selection-invalid`，不会抛出边界异常。
- 逃逸路径返回 `index-path-invalid`；所有非法输入都在调用注入 repository 的 pending 替换方法前失败。
