### Case INDEX-RUNTIME-DEFINITION-003: 拒绝通过原型继承的查询字段与来源属性

Tests:
- `test:a3dea116a1d7a7661aee5b9f30703ac5ea56729f155eeb35bd984a1853bed3a8`

Tags:
- `index-runtime`

Contract:
- 封闭 query field 与 source descriptor 的必填属性必须是 descriptor 自身属性，不能通过原型链补足。

Proves:
- 仅从原型继承 `mode`、`name`、`sources` 的 field 在 definition 构造时失败。
- 仅从原型继承 `kind` 的 source 在 definition 构造时失败。
- 仅从原型继承的可选 `normalization` 不会被当作 descriptor 自身配置采用。
