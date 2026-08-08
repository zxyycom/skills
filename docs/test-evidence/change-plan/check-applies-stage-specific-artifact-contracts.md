### Case CHANGE-PLAN-CHECK-STAGES-001: 检查按生命周期阶段应用制品契约
Entry:
- `tools/change-plan/tests/check.test.ts > check applies stage-specific artifact contracts`
- `bun test --test-name-pattern="^check applies stage-specific artifact contracts$" ./tools/change-plan/tests/run.ts`
Contract:
- Change 检查必须按当前阶段或目标阶段应用对应的制品要求。
Proves:
- Draft 只有最小 proposal 时可以通过，面向 plan 的检查要求完整制品，合法 shelved change 仍可通过检查。
