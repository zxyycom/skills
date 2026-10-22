### Case INVESTIGATION-CLI-NEW-AUXILIARY-001: 候选起草不附加发布辅助预检

Tests:
- `test:8c1e5302f63022396d226ec54d6670dc71bb0d2706cac5d10cd549a21de946bd`

Tags:
- `investigation-report`

Contract:
- new 完成本地创建与 readiness 摘要后结束，不默认执行独立发布辅助预检。

Proves:
- 创建摘要之后注入集合读取拒绝，CLI 退出 0 且后续集合读取计数为零；stdout 不回显预检、stderr 不报告辅助预检失败，磁盘保留历史日期 ID 的候选。
