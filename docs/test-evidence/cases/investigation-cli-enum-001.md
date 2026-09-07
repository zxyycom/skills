### Case INVESTIGATION-CLI-ENUM-001: CLI leaves relation and trace enum values for API validation

Tests:
- `test:e13cbb8627a5f97b0c1cfea372b38a98254a697e9b0f34a64ab2f74b5a3a70dd`

Tags:
- `investigation-report`

Contract:
- CLI 只负责参数分组；关系类型和 trace direction 的领域枚举由公共 API 校验。

Proves:
- 未知关系类型和 direction 均以操作错误退出，只向 stderr 返回领域诊断。
