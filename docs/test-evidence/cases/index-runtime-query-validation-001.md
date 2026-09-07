### Case INDEX-RUNTIME-QUERY-VALIDATION-001: 拒绝未知模式不匹配及多值排序键

Tests:
- `test:c53a3c598e53d352e8e15574947fb01e1e1020ebf2607cf843f4e272ecc6fef6`

Tags:
- `index-runtime`

Contract:
- 查询必须先验证键存在、过滤模式匹配且排序键为单值。

Proves:
- 未知键、模式不匹配和多值排序分别返回错误结果。
