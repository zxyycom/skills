### Case CHANGE-PLAN-CHECK-PATH-001: 检查报告 change 目录路径问题
Entry:
- `tools/change-plan/tests/check.test.ts > check reports change directory path diagnostics`
- `bun test --test-name-pattern="^check reports change directory path diagnostics$" ./tools/change-plan/tests/run.ts`
Contract:
- Change 目录名称与位置必须满足路径契约。
Proves:
- 非法目录身份产生可定位的路径诊断。
