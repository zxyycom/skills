### Case CHANGE-PLAN-ASSESS-CURRENT-001: 基线可用的计划保持当前
Entry:
- `tools/change-plan/tests/assessment.test.ts > assessment keeps a plan with an available base current`
- `bun test --test-name-pattern="^assessment keeps a plan with an available base current$" ./tools/change-plan/tests/run.ts`
Contract:
- Plan 的 `baseCommit` 可解析、位于当前 HEAD 的第一父历史且项目没有推进时，评估必须保持 `current`。
Proves:
- 评估返回相同基线与 HEAD、零距离及固定 `git-distance-v1` 策略。
