### Case INDEX-EXACT-LIFECYCLE-001: 查询成员集合不跨 reader 查询泄漏

Tests:
- `test:9f27ef435f22627063ac3033607dfb71df4581448a8cae6becb6288b1be5939a`

Tags:
- `performance`
- `semantic-fidelity`

Contract:
- reader 查询与 overlay 不修改静态快照，筛选先于稳定排序与分页，total 不受 limit 限制。

Proves:
- 同一 reader 切换 requested ID 后返回正确成员；overlay 只影响当次结果，倒序分页保留精确 total。
