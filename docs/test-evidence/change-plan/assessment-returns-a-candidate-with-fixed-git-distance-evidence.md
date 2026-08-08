### Case CHANGE-PLAN-ASSESS-CANDIDATE-001: 评估返回固定 Git 距离候选证据
Entry:
- `tools/change-plan/tests/assessment.test.ts > assessment returns a candidate with fixed git-distance-v1 evidence`
- `bun test --test-name-pattern="^assessment returns a candidate with fixed git-distance-v1 evidence$" ./tools/change-plan/tests/run.ts`
Contract:
- 已确认 plan 达到固定 Git 距离阈值时，评估必须返回可供机械搁置使用的完整候选证据。
Proves:
- 4 个相关提交和 1001 行变更返回 `shelve-candidate`，并包含基线、HEAD 和 `git-distance-v1` 策略。
