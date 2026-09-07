### Case TEST-EVIDENCE-PROJECT-OUTPUT-SAFETY-001: 项目生产器拒绝不支持命令并保留独占输出

Tests:
- `test:f1a7d3ea9aa625f10475402ae5af0454887bb174f4ca9a2cfe42a5254a84dfda`

Tags:
- `repository-tooling`

Contract:
- 不支持的测试脚本必须失败，且已有的请求输出不得被覆盖。

Proves:
- 非法命令被拒绝，已有输出保持逐字节不变。
