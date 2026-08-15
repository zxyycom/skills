### Case REPO-SKILL-HASH-003: Declaration formatting does not require a version

Entry:
- `scripts/lib/skill-package-hash.test.ts > ignores declaration formatting but not declaration semantics for versioning`
- `bun test --test-name-pattern="^ignores declaration formatting but not declaration semantics for versioning$" ./scripts/lib/skill-package-hash.test.ts`

Contract:
- 成对存在的 `.d.mts` 以根目录 `.oxfmtrc.json` 的 Oxfmt 配置规范化后确定版本承载；纯格式差异不承载版本，语义差异承载版本。

Proves:
- 可规范化为同一声明的差异不产生版本门禁诊断。
- 声明类型语义变化在未提升 metadata.version 时产生版本门禁诊断。
