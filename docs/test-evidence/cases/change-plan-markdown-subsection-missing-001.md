### Case CHANGE-PLAN-MARKDOWN-SUBSECTION-MISSING-001: Markdown 报告缺失的必需子章节

Tests:
- `test:a60e39ad68d9f3601b8986ecc44b860165f26451cb3ca3392b17db134cffda88`

Tags:
- `change-plan`

Contract:
- Artifact contract 在指定 H2 内要求完整的必需 H3 集合。

Proves:
- 缺少 `Resulting Impacts` 时产生指向该 H3 的缺失章节诊断。
