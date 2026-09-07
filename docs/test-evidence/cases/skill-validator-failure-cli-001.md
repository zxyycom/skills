### Case SKILL-VALIDATOR-FAILURE-CLI-001: Validator CLI 报告无效 skill 失败

Tests:
- `test:6297904746242c3520a05598b1ed67d03ed9d4e721c0262fab2f4d7f2510f4e5`

Tags:
- `skill-validator`

Contract:
- CLI 遇到无效 skill 时必须返回失败退出码并把验证诊断写入 stderr。

Proves:
- 无效 frontmatter 令 CLI 返回 1，并显示结构验证失败及名称诊断。
