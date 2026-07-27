### Case SKILL-PACKAGE-HASH-002: 报告缺失或畸形的 skill 版本基线
Entry:
- `scripts/lib/skill-package-hash.test.ts > reports missing or malformed skill version baselines`
- `bun test --test-name-pattern="^reports missing or malformed skill version baselines$" ./scripts/lib/skill-package-hash.test.ts`
Contract:
- 版本基线修订必须存在，基线 `metadata.version` 必须为正整数字符串。
Proves:
- 缺失修订保留 `revision-not-found`，畸形版本返回明确 frontmatter 约束错误。
