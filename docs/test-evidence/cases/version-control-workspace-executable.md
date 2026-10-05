### Case VERSION-CONTROL-WORKSPACE-EXECUTABLE-001: 工作区执行位读取尊重 Git 策略

Tests:
- `test:4fa7dd02ce53d878d3ddd513dc22edb1a11f2a5f2d2b7e0ffc39c18f43b53ea5`

Tags:
- `version-control`

Contract:
- 共享常规工作区文件读取使用有效执行位；`core.fileMode` 为 `false` 时保留常规 pending 表示，没有 pending 条目的路径使用 `regular`。

Proves:
- 启用策略时工作区用户执行位决定 kind；关闭策略时不受工作区相反执行位干扰，分别保留 pending 的普通或可执行表示。
- 关闭策略时新增可执行工作区文件返回 regular。
