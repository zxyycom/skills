### Case INDEX-PREPARED-SAFE-READ-001: baseline 读取拒绝 inode 与父路径替换

Tests:
- `test:41a9367b0f016df39c5f336dbfc1f51680f29f227705b7b158601c23cfd261eb`

Tags:
- `index-runtime`

Contract:
- baseline 必须以同一安全 FileHandle、稳定 canonical 路径和真实父目录身份链取得实际字节。

Proves:
- 读取期间替换目标 inode 或 symlink 父路径会失败；读取完成后替换 root/nested 普通目录，即使 hardlink 保持文件 dev/ino/size/mtime/ctime/bytes 全相同，仍拒绝签发可信 baseline。
