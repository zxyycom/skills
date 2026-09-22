### Case INVESTIGATION-CLI-INVESTIGATIONS-DIR-BOUNDARY-001: 绝对与越界调查目录按普通参数错误失败

Tests:
- `test:86b51027ac1a4d1e067afaa48065b343b88a54cbae35d3fd6ff08bb8e18f9fdf`

Tags:
- `investigation-report`

Contract:
- `--investigations-dir` 只接受解析后仍位于 `--root` 内的相对路径；绝对目录与越界相对路径都按普通参数错误失败，不保留旧绝对目录解析分支。

Proves:
- 绝对目录与 `../` 越界目录的 CLI 调用都以退出码 `2` 结束，stdout 为空，stderr 分别给出相对与包含约束诊断。
