### Case SKILL-VALIDATOR-DIAGNOSTICS-001: 无效 frontmatter metadata 可诊断

Tests:
- `test:e532344134262ab1b24180fba826df07af9a7243892f9e47a60414169fe6659d`

Tags:
- `skill-validator`

Contract:
- Validator 必须独立报告非法名称、目录名称不匹配和空 description。

Proves:
- 三类 frontmatter metadata 错误都产生可定位诊断。
