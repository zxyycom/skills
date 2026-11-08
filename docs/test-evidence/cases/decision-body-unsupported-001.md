### Case DECISION-BODY-UNSUPPORTED-001: 决策正文字段不归一化任意相似符号

Tests:
- `test:8ce1fc1b8d1c9ca171604664041ffbf4c585c7fe1d3b2898baaef6c31d0f69c8`

Tags:
- `decision-records`

Contract:
- 决策正文结构校验只按 Markdown 无序列表和冒号分隔结构识别必填 `采用` 字段，不把任意相似符号归一化为合法结构。

Proves:
- 原生正文评估对 `• 采用: ...` 和 `- 采用; ...` 均不 ready，且报告包含 `采用` 的字段错误。
