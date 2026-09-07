### Case SKILL-VALIDATOR-FRONTMATTER-001: 损坏的 skill frontmatter 可诊断

Tests:
- `test:10e58bdd142cbb554b6c25ed78aef67dcae4d5fa171a43ef8dde05e9bfe652de`

Tags:
- `skill-validator`

Contract:
- 无法解析的 YAML frontmatter 必须作为入口结构错误报告。

Proves:
- Validator 返回以 `SKILL.md frontmatter` 开头的解析诊断。
