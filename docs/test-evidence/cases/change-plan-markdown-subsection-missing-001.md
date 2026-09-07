### Case CHANGE-PLAN-MARKDOWN-SUBSECTION-MISSING-001: Markdown 报告缺失的必需子章节

Tests:
- `test:c5fc176a0c54494deff21f0fadb2d1c59a773872b2139f1ca473fc5143bad991`

Tags:
- `change-plan`

Contract:
- Artifact contract 在指定 H2 内要求完整的必需 H3 集合。

Proves:
- 缺少 `Resulting Impacts` 时产生指向该 H3 的缺失章节诊断。
