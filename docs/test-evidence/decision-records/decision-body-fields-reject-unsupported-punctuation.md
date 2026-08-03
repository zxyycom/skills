### Case DECISION-BODY-UNSUPPORTED-001: 决策正文字段不归一化任意相似符号

Entry:
- `tools/decision-records/tests/body-field-validation.test.ts > decision body fields reject unsupported punctuation`
- `bun test --test-name-pattern="^decision body fields reject unsupported punctuation$" ./tools/decision-records/tests/run.ts`

Contract:
- 决策正文结构校验只按 Markdown 无序列表和冒号分隔结构识别必填 `采用` 字段，不把任意相似符号归一化为合法结构。

Proves:
- `• 采用: ...` 与 `- 采用; ...` 都返回标准字段缺失诊断，且不生成决策文档。
