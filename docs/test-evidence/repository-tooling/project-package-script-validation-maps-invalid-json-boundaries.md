### Case REPO-PACKAGE-JSON-001: 项目 package script 校验映射非法 JSON 边界
Entry:
- `scripts/validators/project-config.test.ts > project package script validation maps invalid JSON boundaries`
- `bun test --test-name-pattern="^project package script validation maps invalid JSON boundaries$" ./scripts/validators/project-config.test.ts`
Contract:
- 项目配置校验必须把无法解析的 `package.json` 和非法的 `scripts` 结构转换为可定位诊断，而不是让未经校验的外部值进入脚本清单检查。
Proves:
- 无法解析的 JSON 返回带有 `package.json is not valid JSON` 前缀的单条诊断。
- `scripts` 为数组时返回要求 object 的稳定诊断。
