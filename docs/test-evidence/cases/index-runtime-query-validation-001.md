### Case INDEX-RUNTIME-QUERY-VALIDATION-001: 拒绝未知模式不匹配及多值排序键

Tests:
- `test:3abb1bc7410aa735993e29202768786d0ada67e51d0ec21b8136d478e5adeba9`

Tags:
- `index-runtime`

Contract:
- 查询必须先验证键存在、过滤模式匹配且排序键为单值。

Proves:
- 未知键、模式不匹配和多值排序分别返回错误结果。
