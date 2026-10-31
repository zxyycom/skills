### Case INDEX-RUNTIME-PARSER-RETURN-ISOLATION-001: 隔离领域 parser 返回的外部可变对象

Tests:
- `test:de7c88f82eb8f942fd9588a065b5edbd177337cda9fec184c9af2eb5221b3374`

Tags:
- `index-runtime`

Contract:
- parser 可以返回调用方持有的可变 JSON 对象；索引必须复制隔离，不冻结外部对象，也不被后续外部修改污染。

Proves:
- metadata/state parser 返回共享外部嵌套对象；结果递归冻结但外部对象仍可变，修改外部数据后两个 state 和 metadata 仍保留原值。
