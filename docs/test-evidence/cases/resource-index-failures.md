### Case RESOURCE-INDEX-FAILURES-001: 索引写入失败边界

Tests:
- `test:13c77d9d56131e995b1ed0cbcc119a9b8dec0cacc873cc279639ede5166d86be`
- `test:67ad3e151a19bc62982a094474989057115363d3eaf28d57e30d8a5170cb7ba0`
- `test:b5a888e2ce21a92cfd42d1bccb2159753e0e3e1505cd7f8cf2bdd1d004a5853f`

Tags:
- `resource-records`

Contract:
- 校验失败不替换既有索引；空集合可同步，写入失败按实际状态报告。

Proves:
- 重复 ID 的源校验失败保留索引字节；目录冲突阻断创建，空集合可恢复；Windows 只读目标替换失败保留字节。
