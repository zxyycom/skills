### Case CHANGE-PLAN-CHECK-STAGES-001: 检查按生命周期阶段应用制品契约

Tests:
- `test:e5e49a663f1a034b2b26d0c54a913b6e7819480b529e6d606887672047b56487`

Tags:
- `change-plan`

Contract:
- Change 检查按当前阶段或目标阶段确定必需 artifacts；stage 不改变 `Scope` 与 `Decisions` 的固定内部结构。

Proves:
- 普通 Draft 检查接受最小 proposal 和初始 design、但没有 tasks 的目录；Draft proposal 追加 `Scope` 时仍要求固定 H3，并拒绝缺少 design 的目录。
- Metadata 仍为 `draft` 时，目标 Plan 检查要求完整 proposal、design、tasks 及 `Intended Change`、`Resulting Impacts` H3；缺少 H3 或 tasks 时报告对应诊断。
