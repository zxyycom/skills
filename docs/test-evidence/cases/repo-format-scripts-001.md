### Case REPO-FORMAT-SCRIPTS-001: 格式化命令覆盖全部维护源码

Tests:
- `test:380ad1881bb57ff927a3c661f29aa34f63a4e0a682919422994c047362c2be7a`

Tags:
- `repository-tooling`

Contract:
- package script 校验必须拒绝偏离正式 Oxfmt 写入命令的配置；该命令覆盖 `scripts/` 的 TypeScript/JavaScript 和 `tools/` 的 TypeScript 源码，后者包含维护的 `.d.mts` 声明源。

Proves:
- 独立字面预期固定 oxfmt --write/--check 对 scripts/**/*.{ts,js},tools/**/*.ts 的完整命令；不以同一生产常量生成预期。
- 偏离任一格式化命令的 package JSON 均给出可行动诊断，不能缩为只覆盖 scripts。
