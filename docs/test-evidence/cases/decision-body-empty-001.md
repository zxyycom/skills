### Case DECISION-BODY-EMPTY-001: 决策正文字段值必须同行非空

Tests:
- `test:c4235a12ddb89d56780cfea587ef58e47afa3272048a20141cf4f336a034c409`

Tags:
- `decision-records`

Contract:
- 决策正文中的必填 `采用` 值必须与字段标签位于同一行，并在去除首尾空白后保持非空。

Proves:
- `-`、`*`、`+` 分别与 `:`、`：` 组合时，空值都返回标准字段缺失诊断，且不生成决策文档。
- 空字段后的下一行内容不会被当作 `采用` 值。
