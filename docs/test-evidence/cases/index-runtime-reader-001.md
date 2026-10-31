### Case INDEX-RUNTIME-READER-001: 创建不可变内存 reader 快照并验证输入

Tests:
- `test:42fff7fdc82af5ea885d3c7e5e732d7fbd915d3b66b2966e37d9ebb90ffca1af`

Tags:
- `index-runtime`

Contract:
- 内存 reader 必须严格解析、复制并冻结有效 state-only 索引，拒绝 definition identity 不匹配或结构畸形输入。

Proves:
- 创建后修改 metadata、删除 keyed entry 或改写直接 state 均不影响查询；公开 reader entry 只包含 `id` 与 `state`；错误 definition version 与非对象 entries 分别触发稳定错误。
