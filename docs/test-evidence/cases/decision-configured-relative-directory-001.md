### Case DECISION-CONFIGURED-RELATIVE-DIRECTORY-001: 相对决策目录从 workspace 根解析

Tests:
- `test:36a71c73a6a837d3ac625ae2e2c7e38dbaf9ab2b1fbc192a32ecf1df534cf967`

Tags:
- `decision-records`

Contract:
- 相对 decisionsDir 必须以 workspace 根为解析基准，并保持工作区相对索引路径。

Proves:
- API 扫描定位配置目录，报告规范相对 index 路径，CLI check 成功。
