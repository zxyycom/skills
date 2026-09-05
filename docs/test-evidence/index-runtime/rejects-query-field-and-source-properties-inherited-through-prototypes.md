### Case INDEX-RUNTIME-DEFINITION-003: 拒绝通过原型继承的查询字段与来源属性
Entry:
- `tools/index-runtime/tests/protocol.test.ts > rejects query field and source properties inherited through prototypes`
- `bun test --test-name-pattern="^rejects query field and source properties inherited through prototypes$" ./tools/index-runtime/tests/run.ts`
Contract:
- 封闭 query field 与 source descriptor 的必填属性必须是 descriptor 自身属性，不能通过原型链补足。
Proves:
- 仅从原型继承 `mode`、`name`、`sources` 的 field 在 definition 构造时失败。
- 仅从原型继承 `kind` 的 source 在 definition 构造时失败。
