### Case SKILL-VALIDATOR-FAILURE-CLI-001: Validator CLI 报告无效 skill 失败
Entry:
- `tools/skill-validator/tests/run.ts > validator CLI reports invalid skill failures`
- `bun test --test-name-pattern="^validator CLI reports invalid skill failures$" ./tools/skill-validator/tests/run.ts`
Contract:
- CLI 遇到无效 skill 时必须返回失败退出码并把验证诊断写入 stderr。
Proves:
- 无效 frontmatter 令 CLI 返回 1，并显示结构验证失败及名称诊断。
