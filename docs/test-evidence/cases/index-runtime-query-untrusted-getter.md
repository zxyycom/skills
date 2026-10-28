### Case INDEX-RUNTIME-QUERY-TRUST-001: 原始冻结 getter 和代理不能获得验证复用

Tests:
- `test:7c478d37b02ecf792a42aba385d0742319f300ce98fcc6196e67d564803b1468`

Tags:
- `index-runtime`

Contract:
- 原始查询输入不能仅因冻结或代理而视为稳定的已验证数据。

Proves:
- 连续字段访问期间 getter 的值变为非 JSON 时，冻结对象及其代理均在第二字段返回字段来源错误。
