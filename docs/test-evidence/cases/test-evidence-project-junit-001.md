### Case TEST-EVIDENCE-PROJECT-JUNIT-001: 项目注册只接受完整 skipped JUnit 报告

Tests:
- `test:216ac30cb50786e451c6fc4c3c5020a10356d5e257e4cf53684a5de0a92d547b`

Tags:
- `repository-tooling`

Contract:
- 注册采集只接受结构完整、每个 testcase 明确 skipped 且没有 failures 或 errors 的 JUnit 报告。

Proves:
- 合法 skipped 报告产生注册实体，缺失、部分、执行失败或非 skipped 报告被阻断。
