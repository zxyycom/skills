### Case CHANGE-PLAN-GIT-BASE-001: Git 距离拒绝缺失与非第一父基线

Tests:
- `test:05939c9a5012b02ce9a9f8c08b01ef8dfc0d36b9df553e7e1e813caa16c84750`

Tags:
- `change-plan`

Contract:
- Git 距离的 measured 输入集合是可解析且位于当前 HEAD 第一父历史上的基线；其他基线返回 `base-unavailable` 及其定位证据。

Proves:
- 无法解析的 revision 返回 base-unavailable。
- 侧分支 revision 不在当前第一父历史时返回 base-unavailable，并保留基线与 HEAD。
