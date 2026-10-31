### Case TEST-EVIDENCE-PROJECT-OUTPUT-SAFETY-001: 项目生产器拒绝不支持命令并保留独占输出

Tests:
- `test:d493c1119b079916405b6a7a529cd0ff57d354976ae909827b50ae18ffcbd168`

Tags:
- `repository-tooling`

Contract:
- 不支持的测试脚本必须失败，且已有的请求输出不得被覆盖。

Proves:
- 非法命令被拒绝，已有输出保持逐字节不变。
