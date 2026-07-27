### Case SKILL-VALIDATOR-ENTRY-STATES-001: 缺失的 skill 入口可诊断
Entry:
- `tools/skill-validator/tests/run.ts > validator reports a missing SKILL.md entry`
- `bun test --test-name-pattern="^validator reports a missing SKILL.md entry$" ./tools/skill-validator/tests/run.ts`
Contract:
- Skill 目录缺少 `SKILL.md` 时必须返回明确的入口缺失诊断。
Proves:
- 缺失入口不会被误判为有效 skill。
