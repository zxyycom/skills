### Case INVESTIGATION-STAGE-RESOURCE-PHASE-SYMLINK-001: 写前复核拒绝同字节符号链接替换

Tests:
- `test:01531bcd5dbd2e60477268b155f217eb2e266fd0c98e17599351b836d911358a`
- `test:6320a133ce3e178f26062671253695256425658f180a912be5d74e67109dc586`
- `test:7ca0ff404a869619cdfd61a5d05d5d1487fe7d8e88594ccc99feee522128baa7`
- `test:d0b2760bbeb4c5cb6a71f755fccc9be37eda4e506919c5c57ead40a94cb71ac6`

Tags:
- `investigation-report`

Contract:
- 所选完整资源树的路径安全必须在准备和写前分别验证，字节相同不能替代表示与路径检查。

Proves:
- 真实文件系统中，首次读取后 root、owner 和中间目录被同字节符号链接替换时，再次资源验证失败，读取计数仍为一次。
- 文件替换的真实 domain stage 代表返回 source-drift，资源只读一次，Git index 原始字节不变。
