### Case CHANGE-PLAN-CHECK-PATH-001: 检查报告 change 目录路径问题
Entry:
- `tools/change-plan/tests/check.test.ts > check reports change directory path diagnostics`
- `bun test --test-name-pattern="^check reports change directory path diagnostics$" ./tools/change-plan/tests/run.ts`
Contract:
- Change 检查把名称、目录身份和必需文件位置问题映射为各自稳定诊断。
Proves:
- 非 kebab-case 名称、缺失目录、不可读取路径、普通文件路径和缺失 `design.md` 分别产生对应的名称、目录或文件诊断。
