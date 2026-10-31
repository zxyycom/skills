### Case INDEX-RUNTIME-QUERY-TRUST-005: 自冻结动态值不能沿用旧校验

Tests:
- `test:55604344d4a7c6a3887365d63c440fe96be15416f9364d329ea835c52c1aebd8`

Tags:
- `index-runtime`

Contract:
- 外部动态对象在校验中变为冻结数据时，不得把之前的验证作为其当前内容证明。

Proves:
- map 返回值的 getter 将自身固定为非 JSON 后，第二字段报告来源错误。
