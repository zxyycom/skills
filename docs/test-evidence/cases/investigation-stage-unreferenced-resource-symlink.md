### Case INVESTIGATION-STAGE-UNREFERENCED-SYMLINK-001: 零引用完整所选树拒绝初始符号链接

Tests:
- `test:2a5e5a147714f7b19eff3136f9b664f6e02465199eb97075d705aec7fad22995`
- `test:3f24a4adc4aa62ec4032eb10d482343f5d2859265f99d32c2c64c84197c10d70`
- `test:52acd92c426625dea312b37041325fe48ef747fa1b1e678131c9a70420fcf7b4`
- `test:7379b594c28e973ef1e0a8219965a8b92651bc2514a140acb07b0a7ff8e0c72c`

Tags:
- `investigation-report`

Contract:
- 完整所选 owner 树的资源根、owner、路径分量与目标文件均不得为符号链接，即使报告没有资源引用。

Proves:
- root、owner、中间目录和文件初始替换均使 all/domain 在资源字节采集前失败，Git index 原始字节不变。
