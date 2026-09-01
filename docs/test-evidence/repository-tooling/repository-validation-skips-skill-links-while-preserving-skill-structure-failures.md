### Case REPOSITORY-VALIDATION-STRUCTURE-001: 根校验跳过 skill 链接但保留结构失败
Entry:
- `scripts/validate.test.ts > repository validation skips skill links while preserving skill structure failures`
- `bun test --test-name-pattern="^repository validation skips skill links while preserving skill structure failures$" ./scripts/validate.test.ts`
Contract:
- 根 `validate` 遍历全部 skill 的结构，但不校验链接；当前维护 Markdown 的全仓链接由 Vibe 原生 `markdown-link-validation` Check 负责。
Proves:
- 含缺失链接且 description 为空的 skill 保留 frontmatter 结构诊断，却不产生缺失链接目标诊断。
