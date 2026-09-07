### Case TEST-EVIDENCE-PROJECT-JUNIT-001: 项目注册只接受完整 skipped JUnit 报告

Tests:
- `test:b1c9223e625fee1ea640d65f6037e8dba13d7d15ea76e915e71ca2a442838d5d`

Tags:
- `repository-tooling`

Contract:
- 注册采集只接受结构完整、每个 testcase 明确 skipped 且没有 failures 或 errors 的 JUnit 报告。

Proves:
- 合法 skipped 报告产生注册实体，缺失、部分、执行失败或非 skipped 报告被阻断。
