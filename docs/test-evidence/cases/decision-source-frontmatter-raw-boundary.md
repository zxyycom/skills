### Case DECISION-SOURCE-RAW-BOUNDARY-001: 原始 Markdown 验证不接纳外部解析捷径

Tests:
- `test:3cc12324727e5e184a3fb53dfcaa969b8a090df79bc0e999371b083e58fa3f4e`

Tags:
- `decision-records`

Contract:
- 公开原始 Markdown 入口必须自行解析与验证，调用方附带的解析对象不能替代原始输入。

Proves:
- 非 mapping YAML 即使附带伪造的已解析 frontmatter 仍被拒绝；正式正文入口先报告 YAML 错误，再按既有顺序报告缺失正文结构。
