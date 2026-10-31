### Case DECISION-SOURCE-RAW-BOUNDARY-001: 原始 Markdown 验证不接纳外部解析捷径

Tests:
- `test:73a5a02cd9a1cd5532bb123c55963b2e83826d38c85726bf27b8f56cd47c26d9`

Tags:
- `decision-records`

Contract:
- 公开原始 Markdown 入口必须自行解析与验证，调用方附带的解析对象不能替代原始输入。

Proves:
- 非 mapping YAML 即使附带伪造的已解析 frontmatter 仍被拒绝；正式正文入口先报告 YAML 错误，再按既有顺序报告缺失正文结构。
