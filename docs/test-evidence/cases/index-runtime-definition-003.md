### Case INDEX-RUNTIME-DEFINITION-003: 拒绝通过原型继承的查询字段与来源属性

Tests:
- `test:94d7f2f26bc0da7de9af6b0eb66e91c36106ed661e420a2219222cc0f759fafb`

Tags:
- `index-runtime`

Contract:
- 封闭 query field 与 source descriptor 的必填属性必须是 descriptor 自身属性，不能通过原型链补足。

Proves:
- 仅从原型继承 `mode`、`name`、`sources` 的 field 在 definition 构造时失败。
- 仅从原型继承 `kind` 的 source 在 definition 构造时失败。
