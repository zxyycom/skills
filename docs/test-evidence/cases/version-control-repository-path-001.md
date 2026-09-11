### Case VERSION-CONTROL-REPOSITORY-PATH-001: 将绝对后代路径转换为规范化仓库路径

Tests:
- `test:d166eb1fe909217268e98151cb5f54d8c1fdc104cb173ce0833c0efb8c09a345`

Tags:
- `version-control`

Contract:
- 文件系统路径转换只接受仓库根下的绝对后代，并返回规范化仓库相对路径。

Proves:
- 转换函数可从版本管理通用入口导入；嵌套绝对路径转换为正斜杠路径，相对路径、仓库根和仓库外路径均返回 `invalid-path`。
