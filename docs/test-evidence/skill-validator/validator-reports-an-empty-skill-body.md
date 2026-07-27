### Case SKILL-VALIDATOR-EMPTY-BODY-001: 空的 skill 正文可诊断
Entry:
- `tools/skill-validator/tests/run.ts > validator reports an empty SKILL.md body`
- `bun test --test-name-pattern="^validator reports an empty SKILL.md body$" ./tools/skill-validator/tests/run.ts`
Contract:
- 仅含 frontmatter、没有可执行指导正文的 `SKILL.md` 必须无效。
Proves:
- Validator 返回正文缺失的明确诊断。
