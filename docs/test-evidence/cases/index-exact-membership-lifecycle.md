### Case INDEX-EXACT-LIFECYCLE-001: 查询成员集合不跨 reader 查询泄漏

Tests:
- `test:87af947b255fad2e368a7eb9c5b8a9b8323523d96daf1dc2c1bbb5143674586d`

Tags:
- `performance`
- `semantic-fidelity`

Contract:
- reader 查询与 overlay 不修改静态快照，筛选先于稳定排序与分页，total 不受 limit 限制。

Proves:
- 同一 reader 切换 requested ID 后返回正确成员；overlay 只影响当次结果，倒序分页保留精确 total。
