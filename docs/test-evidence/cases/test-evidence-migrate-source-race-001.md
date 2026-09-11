### Case TEST-EVIDENCE-MIGRATE-SOURCE-RACE-001: 迁移保留预演后被替换的源

Tests:
- `test:3e079a077dbf4648db55a55c4eb13b8b1e611f93724f2fc08939319929a9bcd8`

Tags:
- `repository-tooling`

Contract:
- 每次覆盖或删除旧源前必须复核预演字节和普通文件身份，并保留并发替换的源。

Proves:
- 测试在 preflight 后、首次写入新索引的实际 `writeFile` 边界以相同字节但新 inode 替换旧 Case；迁移在删除前拒绝该替换文件并恢复本事务写入。
