### Case DECISION-BODY-UNSUPPORTED-001: 决策正文字段不归一化任意相似符号

Tests:
- `test:863d1baa84883612f61c8175e801220c8f50e526d102a262f6fd683f858b52b0`

Tags:
- `decision-records`

Contract:
- 决策正文结构校验只按 Markdown 无序列表和冒号分隔结构识别必填 `采用` 字段，不把任意相似符号归一化为合法结构。

Proves:
- `• 采用: ...` 与 `- 采用; ...` 都返回标准字段缺失诊断，且不生成决策文档。
