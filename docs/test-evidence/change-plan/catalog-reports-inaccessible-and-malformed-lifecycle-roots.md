### Case CHANGE-PLAN-CATALOG-ROOTS-001: 生命周期根目录错误可诊断
Entry:
- `tools/change-plan/tests/catalog.test.ts > catalog reports inaccessible and malformed lifecycle roots`
- `bun test --test-name-pattern="^catalog reports inaccessible and malformed lifecycle roots$" ./tools/change-plan/tests/run.ts`
Contract:
- 不可访问或形态错误的生命周期根目录必须产生明确诊断。
Proves:
- 根目录读取失败不会被解释为空 catalog。
