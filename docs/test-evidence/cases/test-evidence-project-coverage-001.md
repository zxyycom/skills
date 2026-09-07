### Case TEST-EVIDENCE-PROJECT-COVERAGE-001: 项目检查拒绝未被 Case 覆盖的注册测试

Tests:
- `test:00af63449b1c74cb910cfe1ec3526f603ba62e9210b5fd7122068b3dfd5b0efa`

Tags:
- `repository-tooling`

Contract:
- 项目 wrapper 必须要求每个注册实体都有有效 Case，并在覆盖完整时成功。

Proves:
- 临时 Case-only 账本先报告 entity-without-case；补齐第二个 Case 和索引后检查返回 ok。
