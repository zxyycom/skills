### Case REPO-VALIDATION-SKILL-STRUCTURE-001: 结构校验独立拒绝非法 skill 元数据

Tests:
- `test:e62b877f7e9d7868aaa8896dd358e4ad8edefecfb6c185828459b02c41f13735`

Tags:
- `repository-tooling`

Contract:
- 结构校验独立验证 skill 元数据，缺失 description 属于结构错误。

Proves:
- 健康 fixture 单独清空 description 后仅产生预期结构错误，未被配置或链接错误掩盖。
