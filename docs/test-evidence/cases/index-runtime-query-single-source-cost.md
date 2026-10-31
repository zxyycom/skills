### Case INDEX-RUNTIME-QUERY-COST-001: 单查询来源沿用原校验路径

Tests:
- `test:74441891aa8df9e09955d732319f5186d02b0e55ec190ca7e56af4b4c9deef64`

Tags:
- `index-runtime`

Contract:
- 单查询来源沿用原克隆与逐次字段校验路径。

Proves:
- 合法静态单字段投影成功，且未执行构造期证明所用的 own-key 枚举。
