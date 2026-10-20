### Case INVESTIGATION-STAGE-UNREFERENCED-SYMLINK-001: 零引用完整所选树拒绝初始符号链接

Tests:
- `test:326e692a0a6bc445193ecd944b51cbb41257ae341c4b265a4f3a8734210a3acd`
- `test:dace1cc8f773ea34e669dd1eac8967b61a2defcb61175b0c3113d4617a6a2fa9`
- `test:e38d6bd0d1cc585b50e98cf3d1473385e39cade2aab6e30aac05514a3836ed69`
- `test:f0059ec0cadbbc1fa7d6180f18372f51a30b6ad7e7c1ad90110c91265a711c38`

Tags:
- `investigation-report`

Contract:
- 完整所选 owner 树的资源根、owner、路径分量与目标文件均不得为符号链接，即使报告没有资源引用。

Proves:
- 真实文件系统的 root、owner、中间目录和文件初始替换均被资源验证器拒绝；资源字节读取计数为零。
