### Case GATE-JSON-VALIDATION-001: JSON 校验阻断 finding 并对 unavailable fail closed

Entry:
- `scripts/vibe-check.test.ts > JSON validation blocks findings and fails closed when unavailable`
- `bun test --test-name-pattern="^JSON validation blocks findings and fails closed when unavailable$" ./scripts/vibe-check.test.ts`

Contract:
- JSON 语法 finding 必须阻断 aggregate；输入不可用也不能被解释为成功。

Proves:
- 有效 JSON fixture passed，加入无效 JSON 后 Check failed。
- 不存在的项目根使 Check unavailable，并由 aggregate fail closed。
