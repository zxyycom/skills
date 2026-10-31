### Case INVESTIGATION-PUBLISH-RESOURCE-BYTE-UPDATE-001: 同 inode 资源字节更新不阻断发布

Tests:
- `test:9b6f2f67f163791d459053865e2c70d88f04c59035be752fcd4bbe886b549c11`

Tags:
- `investigation-report`

Contract:
- 普通发布保护资源成员身份，不把同 inode 的当前资源内容当作旧 bytes 锁定。

Proves:
- 同 inode 改资源 bytes 后发布成功，正式报告正文/链接原样保留，资源保留新字节。
