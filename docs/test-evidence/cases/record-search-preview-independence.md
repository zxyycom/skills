### Case RECORD-SEARCH-PREVIEWS-001: 预览受限不影响记录身份与完整扫描

Tests:
- `test:03d8ad68972f3865c7165d3d62381cc1b714f1bee834ee176b6f747fe5810b17`
- `test:c810b8db343918856326e384e8ba4522891483f0e74cbfe26452dc5a3bcbe7e2`
- `test:c8a7d3abed98e07ce295d7983fd8ec5df055813cc05fdf0544a7b8a6538d9d9c`
- `test:d178e50829fcfdd2a02396f1aff6bc1c598ff59766b7f7b37d312ebddd126998`

Tags:
- `record-search`

Contract:
- content 搜索的预览预算只限制已返回记录的片段；范围与字符限制分别报告实际省略。

Proves:
- 耗尽字符预算后仍返回后续命中身份及空 previews，并保留 exact 计数和完整扫描/结果覆盖。
- 只有实际省略产生 match-previews 或 preview-characters；领域 warning 按类去重。
