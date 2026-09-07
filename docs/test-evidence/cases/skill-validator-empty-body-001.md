### Case SKILL-VALIDATOR-EMPTY-BODY-001: 空的 skill 正文可诊断

Tests:
- `test:0b90a41d9f48b8c3bd659a4f22202ed601b8c2404c2750eefdc42b8685c9a696`

Tags:
- `skill-validator`

Contract:
- 仅含 frontmatter、没有可执行指导正文的 `SKILL.md` 必须无效。

Proves:
- Validator 返回正文缺失的明确诊断。
