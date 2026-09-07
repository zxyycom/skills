### Case SKILL-VALIDATOR-LINKS-001: Skill 链接必须存在且留在目录边界内

Tests:
- `test:1d627607c5aed7b855c9f0ac5d189153f7f6c6f7b965aa3e37cc3efb2bf33e04`

Tags:
- `skill-validator`

Contract:
- Markdown 链接必须指向存在的 skill 内部目标。

Proves:
- 缺失目标和越出 skill 目录的链接分别产生诊断。
