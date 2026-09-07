### Case REPO-PACKAGE-JSON-001: 项目 package script 校验映射非法 JSON 边界

Tests:
- `test:3d7974de9d45a94565143463d8df54f7f04da89625ed0704b239f7fdaa4c3cc0`

Tags:
- `repository-tooling`

Contract:
- 项目配置校验必须把无法解析的 `package.json` 和非法的 `scripts` 结构转换为可定位诊断，而不是让未经校验的外部值进入脚本清单检查。

Proves:
- 无法解析的 JSON 返回带有 `package.json is not valid JSON` 前缀的单条诊断。
- `scripts` 为数组时返回要求 object 的稳定诊断。
