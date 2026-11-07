### Case NATIVE-RECORD-MUTATION-SELECTED-SYNC-001: 两域选择性同步与诊断

Tests:
- `test:1485e8f104936cefa55fddb1d0195c5dbcf2ed9c459492faae1e00eb3625f767`
- `test:3a5759b0158f12b0628f60a4862798cb3899859c9f1e2ea9eedadbca3a1765fd`
- `test:3d7ed27a8dbc8f22a7661346022083a7e8daf0af93519861725cbe452f4fd98c`
- `test:5e1ac9d0e819b43f19f0357bee8d09f38b09f59988180e4f2e8f8dc22ef9d4fd`
- `test:6d193a90976e6fe87d936d5458d1ea927782e5623ab6d5aeb23fc142ad944541`
- `test:75a0d595998710d9b7e42c356664349de7f54d3de14a6cc1c605b96a4cfd25c2`
- `test:9cc4f6078b124a73140c58049165f937695be107b064645a0a0f3592543eb9bc`
- `test:b57fb8c86345ac03e9f0f5bd132527c69b17a5974afa552b5ed24e5d8866437f`
- `test:b9d37870c1b11ff24c9bd2c0dcb9df5d5240aa21ce1d2a242eafac1c07ac198d`

Tags:
- `record-rust`

Contract:
- 选择性同步须验证完整选择及组合图，并保留未读的非目标来源。

Proves:
- 固定来源和索引核对选择错误、恢复提示、依赖与删除。
