### Case TEST-EVIDENCE-FIXED-CONTRACT-001: Case 查询与同步不依赖项目配置或实体快照

Tests:
- `test:9718f3979c85d7c64a84023784ad58821164c62c9006be8ea9d96732affd83d5`

Tags:
- `test-evidence`

Contract:
- Case 查询与显式索引同步只依赖固定 Case 协议，不要求项目 `package.json`、项目配置或实体快照。

Proves:
- fixture 缺少这三类文件时，显式 sync 仍能写入索引，随后 Node CLI list 返回两个 Case 的有效查询结果。
