### Case CHANGE-PLAN-MARKDOWN-SUBSECTION-DUPLICATE-001: Markdown 报告重复的必需子章节

Entry:
- `tools/change-plan/tests/markdown.test.ts > Markdown reports duplicate required subsections`
- `bun test --test-name-pattern="^Markdown reports duplicate required subsections$" ./tools/change-plan/tests/run.ts`

Contract:
- Artifact contract 在指定 H2 内要求每个必需 H3 只出现一次。

Proves:
- 起始序列之后再次出现 `Intended Change` 时产生重复章节诊断。
