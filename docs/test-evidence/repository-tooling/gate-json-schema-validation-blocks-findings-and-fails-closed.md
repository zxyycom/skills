### Case GATE-JSON-SCHEMA-001: JSON Schema 校验阻断 finding 并对 unavailable fail closed

Entry:
- `scripts/vibe-check.test.ts > JSON schema validation blocks findings and fails closed when unavailable`
- `bun test --test-name-pattern="^JSON schema validation blocks findings and fails closed when unavailable$" ./scripts/vibe-check.test.ts`

Contract:
- JSON Schema 违例必须阻断 aggregate；输入不可用也不能被解释为成功。

Proves:
- 符合 Schema 的 fixture passed，写入违例实例后 Check failed。
- 不存在的项目根使 Check unavailable，并由 aggregate fail closed。
