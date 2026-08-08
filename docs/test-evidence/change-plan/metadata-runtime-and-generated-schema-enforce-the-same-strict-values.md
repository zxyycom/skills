### Case CHANGE-PLAN-METADATA-SCHEMA-001: Metadata 运行时与生成 schema 同步严格校验
Entry:
- `tools/change-plan/tests/metadata.test.ts > metadata runtime and generated schema enforce the same strict values`
- `bun test --test-name-pattern="^metadata runtime and generated schema enforce the same strict values$" ./tools/change-plan/tests/run.ts`
Contract:
- `.change-plan.json` 的 Valibot 运行时 schema 与机械生成 JSON Schema 必须接受和拒绝同一组严格判别联合值。
Proves:
- 两个校验入口都接受规范 draft 与显式 shelved 值，并共同拒绝未知字段、含空白 revision、首尾空白 reason 和超出安全整数范围的 Git 距离。
