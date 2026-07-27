### Case CHANGE-PLAN-CLI-LIST-ROOT-001: List CLI 返回结构化生命周期根诊断
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI list returns structured lifecycle root diagnostics`
- `bun test --test-name-pattern="^CLI list returns structured lifecycle root diagnostics$" ./tools/change-plan/tests/run.ts`
Contract:
- List CLI 的 JSON 模式必须把无效 change 根目录作为结构化查询失败返回。
Proves:
- 根路径不是目录时命令退出 1、stderr 为空，stdout JSON 包含目录形态诊断。
