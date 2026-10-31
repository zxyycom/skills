### Case DECISION-BODY-PUNCTUATION-001: 决策正文字段容忍等价 Markdown 标点

Tests:
- `test:d6a6d169859100c06987326fe62ea79c7db5e3d1efdecf35ab668c9091d4e65a`

Tags:
- `decision-records`

Contract:
- 决策正文结构校验在识别必填 `采用` 字段时，不因 Markdown 等价列表标记或半角、全角冒号差异拒绝文档。

Proves:
- 分别组合 `-`、`*`、`+` 与 `:`、`：` 得到的六种字段行都不产生校验错误，并返回非空决策文档。
