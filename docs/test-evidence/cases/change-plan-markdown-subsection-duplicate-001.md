### Case CHANGE-PLAN-MARKDOWN-SUBSECTION-DUPLICATE-001: Markdown 报告重复的必需子章节

Tests:
- `test:f4fcf18b886e3855010d989d1f7892714d5ebe6dff65f2af5a2f3725e3c1452c`

Tags:
- `change-plan`

Contract:
- Artifact contract 在指定 H2 内要求每个必需 H3 只出现一次。

Proves:
- 起始序列之后再次出现 `Intended Change` 时产生重复章节诊断。
