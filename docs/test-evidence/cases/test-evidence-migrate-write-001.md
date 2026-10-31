### Case TEST-EVIDENCE-MIGRATE-WRITE-001: 迁移写入只替换已验证的旧源

Tests:
- `test:317062ef0faf53282c7c48c69d011777319500078b08b2da2d83d9728b7ad7cb`

Tags:
- `repository-tooling`

Contract:
- 写入只可替换本事务已验证的旧源，并同时发布可被新 Case 校验和索引同步接受的目录。

Proves:
- 成功写入删除已验证旧文件，生成 Case-only 目录；新核心校验和同步写入/检查均成功。
