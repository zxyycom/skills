### Case CHANGE-PLAN-MARKDOWN-SUBSECTION-EMPTY-001: Markdown 报告内容为空的必需子章节

Entry:
- `tools/change-plan/tests/markdown.test.ts > Markdown reports empty required subsections`
- `bun test --test-name-pattern="^Markdown reports empty required subsections$" ./tools/change-plan/tests/run.ts`

Contract:
- Artifact contract 要求每个必需 H3 都包含非空语义内容。

Proves:
- `Resulting Impacts` 没有语义内容时产生空章节诊断。
