### Case TEST-EVIDENCE-MIGRATE-RECOVERY-001: 迁移在并发清理阻断后恢复已验证字节

Tests:
- `test:5e0b27ca070b842553ac5cd1c972682b391f79c40d01ed665d1a57cd5bc96087`

Tags:
- `repository-tooling`

Contract:
- 写入失败时只恢复仍可确认属于本事务的旧字节和权限；并发产生的未知文件必须保留现场。

Proves:
- 测试在清理 `access-control` 旧目录的准确 `rmdir` 调用前注入外来文件；迁移拒绝后旧 Case 与索引恢复其原始字节和权限，新增 cases 目录移除，且外来文件保持不变。
