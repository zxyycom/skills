### Case CHANGE-PLAN-METADATA-SCHEMA-001: Metadata 运行时严格校验生命周期值
Entry:
- `tools/change-plan/tests/metadata.test.ts > metadata runtime enforces strict lifecycle values`
- `bun test --test-name-pattern="^metadata runtime enforces strict lifecycle values$" ./tools/change-plan/tests/run.ts`
Contract:
- `.change-plan.json` 由运行时严格按 `stage` 判别当前字段组合；metadata 不接受 schema version、未知字段或超出字段约束的值。
Proves:
- 运行时接受规范 draft 与显式 shelved 值，并拒绝未知字段、含空白 revision、首尾空白 reason 和超出安全整数范围的 Git 距离。
