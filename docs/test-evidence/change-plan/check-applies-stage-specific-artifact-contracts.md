### Case CHANGE-PLAN-CHECK-STAGES-001: 检查按生命周期阶段应用制品契约
Entry:
- `tools/change-plan/tests/check.test.ts > check applies stage-specific artifact contracts`
- `bun test --test-name-pattern="^check applies stage-specific artifact contracts$" ./tools/change-plan/tests/run.ts`
Contract:
- Change 检查按当前阶段或目标阶段确定必需 artifacts；stage 不改变 `Scope` 与 `Decisions` 的固定内部结构。
Proves:
- 普通 Draft 检查接受最小 proposal 和初始 design、但没有 tasks 的目录；Draft proposal 追加 `Scope` 时仍要求固定 H3，并拒绝缺少 design 的目录。
- Metadata 仍为 `draft` 时，目标 Plan 检查要求完整 proposal、design、tasks 及 `Intended Change`、`Resulting Impacts` H3；缺少 H3 或 tasks 时报告对应诊断。
