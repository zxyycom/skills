### Case INDEX-RUNTIME-QUERY-TRUST-006: 动态字段描述保留访问顺序

Tests:
- `test:d7f771bf0d71508e7130157021953a143e0e316f7a5b5e400520ef674e794189`

Tags:
- `index-runtime`

Contract:
- 动态字段描述不因内部复用资格判定而增加 getter 访问或改变字段物化。

Proves:
- 两个动态来源 getter 各按原顺序访问一次，两个字段的查询值均正确。
