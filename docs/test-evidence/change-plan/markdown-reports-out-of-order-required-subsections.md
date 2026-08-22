### Case CHANGE-PLAN-MARKDOWN-SUBSECTION-ORDER-001: Markdown 报告顺序错误的必需子章节

Entry:
- `tools/change-plan/tests/markdown.test.ts > Markdown reports out-of-order required subsections`
- `bun test --test-name-pattern="^Markdown reports out-of-order required subsections$" ./tools/change-plan/tests/run.ts`

Contract:
- Artifact contract 要求必需 H3 作为所属 H2 的有序起始序列。

Proves:
- `Resulting Impacts` 出现在 `Intended Change` 之前时产生章节顺序诊断。
