### Case SKILL-VALIDATOR-FRONTMATTER-001: 损坏的 skill frontmatter 可诊断
Entry:
- `tools/skill-validator/tests/run.ts > validator reports malformed SKILL.md frontmatter`
- `bun test --test-name-pattern="^validator reports malformed SKILL.md frontmatter$" ./tools/skill-validator/tests/run.ts`
Contract:
- 无法解析的 YAML frontmatter 必须作为入口结构错误报告。
Proves:
- Validator 返回以 `SKILL.md frontmatter` 开头的解析诊断。
