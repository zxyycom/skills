### Case DECISION-CONFIGURED-RELATIVE-DIRECTORY-001: 相对决策目录从 workspace 根解析

Tests:
- `test:fcef13fb73948e365a99fd324a0115f9384ef43de58d682f1092167fd28fa0fa`

Tags:
- `decision-records`

Contract:
- 相对 decisionsDir 必须以 workspace 根为解析基准，并保持工作区相对索引路径。

Proves:
- API 扫描定位配置目录，报告规范相对 index 路径，CLI check 成功。
