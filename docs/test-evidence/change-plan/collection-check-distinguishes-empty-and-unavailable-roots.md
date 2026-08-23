### Case CHANGE-PLAN-COLLECTION-ROOTS-001: 集合检查区分空集合与不可用根目录
Entry:
- `tools/change-plan/tests/catalog.test.ts > collection check distinguishes empty and unavailable roots`
- `bun test --test-name-pattern="^collection check distinguishes empty and unavailable roots$" ./tools/change-plan/tests/run.ts`
Contract:
- 集合检查必须把可访问的空目标集合与无法访问的 change root 区分为不同结果。
Proves:
- Active 空集合以零计数通过；缺失 change root 保留根级错误并使集合失败。
