### Case CHANGE-PLAN-LIFECYCLE-VC-001: 生命周期版本控制失败不写 metadata
Entry:
- `tools/change-plan/tests/lifecycle.test.ts > lifecycle returns a stable version-control failure without metadata mutation`
- `bun test --test-name-pattern="^lifecycle returns a stable version-control failure without metadata mutation$" ./tools/change-plan/tests/run.ts`
Contract:
- 阶段转换依赖 plan assessment 时，版本控制不可用必须返回稳定失败并在任何写入前停止。
Proves:
- 非仓库 plan 的 `implement` 返回 `version-control-failed`、`fromStage: plan`、对应诊断和可行动消息，不返回虚构目标阶段，且 `.change-plan.json` 字节保持不变。
