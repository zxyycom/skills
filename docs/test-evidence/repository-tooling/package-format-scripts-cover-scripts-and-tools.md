### Case REPO-FORMAT-SCRIPTS-001: 格式化命令覆盖全部维护源码

Entry:
- `scripts/validators/project-config.test.ts > format scripts cover repository automation and distributable tool sources`
- `bun test --test-name-pattern="^format scripts cover repository automation and distributable tool sources$" ./scripts/validators/project-config.test.ts`

Contract:
- package script 校验必须拒绝偏离正式 Oxfmt 写入命令的配置；该命令覆盖 `scripts/` 的 TypeScript/JavaScript 和 `tools/` 的 TypeScript 源码，后者包含维护的 `.d.mts` 声明源。

Proves:
- 偏离正式 `format` 或 `format:check` 命令的 package JSON 会分别得到可行动的校验诊断。
- 写入与只读格式化命令都不能退化为只覆盖主仓库脚本。
