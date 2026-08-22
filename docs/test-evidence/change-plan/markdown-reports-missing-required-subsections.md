### Case CHANGE-PLAN-MARKDOWN-SUBSECTION-MISSING-001: Markdown 报告缺失的必需子章节

Entry:
- `tools/change-plan/tests/markdown.test.ts > Markdown reports missing required subsections`
- `bun test --test-name-pattern="^Markdown reports missing required subsections$" ./tools/change-plan/tests/run.ts`

Contract:
- Artifact contract 在指定 H2 内要求完整的必需 H3 集合。

Proves:
- 缺少 `Resulting Impacts` 时产生指向该 H3 的缺失章节诊断。
