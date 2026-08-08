### Case CHANGE-PLAN-ASSESS-CURRENT-001: 已确认且未变化的计划保持当前
Entry:
- `tools/change-plan/tests/assessment.test.ts > assessment keeps a confirmed unchanged plan current`
- `bun test --test-name-pattern="^assessment keeps a confirmed unchanged plan current$" ./tools/change-plan/tests/run.ts`
Contract:
- Plan 制品按 Git 属性与已确认基线一致且项目没有推进时，评估必须保持 `current`。
Proves:
- 制品在 HEAD 得到确认，评估返回相同基线与 HEAD、零距离及固定 `git-distance-v1` 策略。
- `core.autocrlf=true` 产生的干净 CRLF 工作树仍由 Git 判定为与 LF blob 一致。
