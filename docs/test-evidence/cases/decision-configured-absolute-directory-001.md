### Case DECISION-CONFIGURED-ABSOLUTE-DIRECTORY-001: 绝对决策目录可位于 workspace 之外

Tests:
- `test:93bdf6ad375f7690d90ce0f459f43b3522dad3cd90bc39c0c40fb885f3f75964`

Tags:
- `decision-records`

Contract:
- 显式绝对 decisionsDir 必须直接定位工作区外的决策集合，并保持绝对索引路径。

Proves:
- API 扫描不把绝对目录重定位到 workspace 内，CLI check 对外部集合成功。
