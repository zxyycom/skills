### Case VERSION-CONTROL-REPOSITORY-PATH-001: 将绝对后代路径转换为规范化仓库路径

Tests:
- `test:4746b87a78a42c8e3bb59f1bbfcb6f94ddebe974d36e4fb6bd915afa4b88b73c`

Tags:
- `version-control`

Contract:
- 文件系统路径转换只接受仓库根下的绝对后代，并返回规范化仓库相对路径。

Proves:
- 转换函数可从版本管理通用入口导入；嵌套绝对路径转换为正斜杠路径，相对路径、仓库根和仓库外路径均返回 `invalid-path`。
