### Case INVESTIGATION-REPORT-STRUCTURE-001: validation enforces one report with fixed core and optional resource section

Tests:
- `test:6a9db07c48423a95ae0e04a5d3d9eb924ba229da8ca320c8774f51b12225580a`

Tags:
- `investigation-report`

Contract:
- 每个 Markdown 是一份报告，前四个 H2 固定；可选随附资源在第五位，附加语义 H2 仅可位于核心或资源之后，fence 内标题不参与结构识别。

Proves:
- Markdown 解析器拒绝旧无 frontmatter 内容；核心后或资源后附加章节以及 fenced 标题通过；插入核心、资源之前或非规范资源标题各被拒绝。
