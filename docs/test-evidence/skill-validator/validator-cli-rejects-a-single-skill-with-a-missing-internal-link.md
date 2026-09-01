### Case SKILL-VALIDATOR-LINKS-CLI-001: Validator CLI 拒绝缺失内部链接的单个 skill
Entry:
- `tools/skill-validator/tests/run.ts > validator CLI rejects a single skill with a missing internal link`
- `bun test --test-name-pattern="^validator CLI rejects a single skill with a missing internal link$" ./tools/skill-validator/tests/run.ts`
Contract:
- 显式 `validate-skill` 校验单个 skill 时，内部 Markdown 链接必须指向该 skill 目录内存在的目标。
Proves:
- 仅含缺失内部链接的其他结构合法 skill 令分发 CLI 以失败退出，并报告缺失链接目标。
