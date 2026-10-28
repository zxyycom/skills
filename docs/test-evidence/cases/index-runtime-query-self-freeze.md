### Case INDEX-RUNTIME-QUERY-TRUST-005: 自冻结动态值不能沿用旧校验

Tests:
- `test:4d0ccd970307078183b298c2570ccfadc5002b6e9cb2cf2dfd4e8c1b394c9616`

Tags:
- `index-runtime`

Contract:
- 外部动态对象在校验中变为冻结数据时，不得把之前的验证作为其当前内容证明。

Proves:
- map 返回值的 getter 将自身固定为非 JSON 后，第二字段报告来源错误。
