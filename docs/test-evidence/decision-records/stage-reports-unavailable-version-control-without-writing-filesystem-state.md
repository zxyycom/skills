### Case DECISION-STAGE-VERSION-CONTROL-001: Stage 在无版本控制时不写入来源

Entry:
- `tools/decision-records/tests/stage.test.ts > stage reports unavailable version control without writing filesystem state`
- `bun test --test-name-pattern="^stage reports unavailable version control without writing filesystem state$" ./tools/decision-records/tests/run.ts`

Contract:
- stage 需要受版本控制的 workspace；不可用时不改动决策来源。

Proves:
- 无 Git workspace 返回诊断且正文不变。
