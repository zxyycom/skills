### Case CHANGE-PLAN-CHECK-STAGES-001: 检查按生命周期阶段应用制品契约
Entry:
- `tools/change-plan/tests/check.test.ts > check applies stage-specific artifact contracts`
- `bun test --test-name-pattern="^check applies stage-specific artifact contracts$" ./tools/change-plan/tests/run.ts`
Contract:
- Change 检查必须按当前阶段或目标阶段应用对应的制品要求。
Proves:
- 普通 Draft 检查接受最小 proposal 和初始 design、但没有 tasks 的目录，并拒绝缺少 design 的目录。
- Metadata 仍为 `draft` 时，目标 Plan 检查要求完整 proposal、design 和 tasks；合法 shelved Change 仍可通过检查。
