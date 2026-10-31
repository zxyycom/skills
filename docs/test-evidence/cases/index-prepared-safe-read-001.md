### Case INDEX-PREPARED-SAFE-READ-001: baseline 读取拒绝 inode 与父路径替换

Tests:
- `test:6080fe4aacb1782a4010d0416b2156b733c61cf9e708b0cdec096367021db0b0`

Tags:
- `index-runtime`

Contract:
- baseline 必须以同一安全 FileHandle、稳定 canonical 路径和真实父目录身份链取得实际字节。

Proves:
- 读取期间替换目标 inode 或 symlink 父路径会失败；读取完成后替换 root/nested 普通目录，即使 hardlink 保持文件 dev/ino/size/mtime/ctime/bytes 全相同，仍拒绝签发可信 baseline。
