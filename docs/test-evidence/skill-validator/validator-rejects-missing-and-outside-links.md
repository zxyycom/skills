### Case SKILL-VALIDATOR-LINKS-001: Skill 链接必须存在且留在目录边界内
Entry:
- `tools/skill-validator/tests/run.ts > validator rejects missing and outside links`
- `bun test --test-name-pattern="^validator rejects missing and outside links$" ./tools/skill-validator/tests/run.ts`
Contract:
- Markdown 链接必须指向存在的 skill 内部目标。
Proves:
- 缺失目标和越出 skill 目录的链接分别产生诊断。
