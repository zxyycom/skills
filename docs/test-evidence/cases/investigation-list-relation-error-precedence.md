### Case INVESTIGATION-LIST-RELATION-ERRORS-001: 关系名称歧义与索引失败保持原优先级

Tests:
- `test:584e2c3db49a100a822e6ebe14db4844e2f87bcba399b801f0bb59ec403241de`

Tags:
- `investigation-report`

Contract:
- 关系 selector 必须在同一合法快照内唯一解析；其他过滤为空不能消除歧义，索引加载失败先于 selector 处理。

Proves:
- 两个日期 ID 共享 name 时，即使 tag 零命中仍返回歧义；输入加载失败时保留 index-missing，不报告名称歧义。
