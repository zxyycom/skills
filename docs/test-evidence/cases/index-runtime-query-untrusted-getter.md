### Case INDEX-RUNTIME-QUERY-TRUST-001: 原始冻结 getter 和代理不能获得验证复用

Tests:
- `test:1a643846001d2020462826e164ffcae85ef36feaf3357e81a43a222e62dd1dd8`

Tags:
- `index-runtime`

Contract:
- 原始查询输入不能仅因冻结或代理而视为稳定的已验证数据。

Proves:
- 连续字段访问期间 getter 的值变为非 JSON 时，冻结对象及其代理均在第二字段返回字段来源错误。
