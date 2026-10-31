### Case CHANGE-PLAN-ROOT-REPOSITORY-GATE-001: 整个 Change 根的子仓库阻断查询和写入

Tests:
- `test:ce9e67ebabf5d57fbaa1f9c152178bd2e54de517beee5708fdc4b5a0ecafef33`

Tags:
- `change-plan`
- `repository-boundary`

Contract:
- Change 根的活动真实目录树只承载所属项目仓库的计划数据；任意深度的子仓库使整次命令失败，阶段筛选和单个目标选择不能绕过该边界。

Proves:
- 兄弟目录深处的真实 Git 仓库使六个命令、Draft 筛选和 finalize 预检均退出 1 且无 Git 调用；集合返回空成员与含违规路径的根级错误。
- check 返回 change-root-contains-repository；show 不返回产物正文，plan 与两种 finalize 模式均不写入，目标元数据及根成员保持原样。
