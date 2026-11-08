### Case DECISION-BODY-PUNCTUATION-001: 决策正文字段容忍等价 Markdown 标点

Tests:
- `test:8ce1fc1b8d1c9ca171604664041ffbf4c585c7fe1d3b2898baaef6c31d0f69c8`

Tags:
- `decision-records`

Contract:
- 决策正文结构校验在识别必填 `采用` 字段时，不因 Markdown 等价列表标记或半角、全角冒号差异拒绝文档。

Proves:
- 原生正文评估对 `-`、`*`、`+` 与 `:`、`：` 的六种非空组合均返回 body ready 且无 scaffold 错误。
