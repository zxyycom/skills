### Case INDEX-RUNTIME-QUERY-COST-001: 单查询来源沿用原校验路径

Tests:
- `test:e5a04cfa34d3c1bb1efe1a3e3af5cc1b8a80b5dd7d7949fdfc75c7c31822b0c7`

Tags:
- `index-runtime`

Contract:
- 单查询来源沿用原克隆与逐次字段校验路径。

Proves:
- 合法静态单字段投影成功，且未执行构造期证明所用的 own-key 枚举。
