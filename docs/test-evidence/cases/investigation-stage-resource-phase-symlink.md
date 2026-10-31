### Case INVESTIGATION-STAGE-RESOURCE-PHASE-SYMLINK-001: 写前复核拒绝同字节符号链接替换

Tests:
- `test:28534d0721b777792944d9d67648cd6d43a1f07a7a03d9d6226268d8aa0b7209`
- `test:47d0e74090afe1427c6511c6c556fe05996be9014d0f265abd408c0f6b0ab9c4`
- `test:ac36ca1aee2340863a505bdf2e663295d240432c154f4f7bbf297b4c7443cab0`
- `test:c7cb10b4533fdf157a89c0d176e773c7e03b463aaacfc96c8f40c917d2fc8ed9`

Tags:
- `investigation-report`

Contract:
- 所选完整资源树的路径安全必须在准备和写前分别验证，字节相同不能替代表示与路径检查。

Proves:
- 真实文件系统中，首次读取后 root、owner 和中间目录被同字节符号链接替换时，再次资源验证失败，读取计数仍为一次。
- 文件替换的真实 domain stage 代表返回 source-drift，资源只读一次，Git index 原始字节不变。
