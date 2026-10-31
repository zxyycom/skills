### Case CHANGE-PLAN-MARKDOWN-SUBSECTION-DUPLICATE-001: Markdown 报告重复的必需子章节

Tests:
- `test:ed2b40ba6dd053dae21a409bc227d4fd3377ff03e24e8ed229bfe57d5caa9d18`

Tags:
- `change-plan`

Contract:
- Artifact contract 在指定 H2 内要求每个必需 H3 只出现一次。

Proves:
- 起始序列之后再次出现 `Intended Change` 时产生重复章节诊断。
