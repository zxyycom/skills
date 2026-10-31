### Case INVESTIGATION-STAGE-UNREFERENCED-SYMLINK-001: 零引用完整所选树拒绝初始符号链接

Tests:
- `test:584d1df868f427f8ed01541594c006cceccfae0e5f88be47b2dc581ac79cabff`
- `test:74eb02b382410407bd70ffe2ddb4c10620dac50619fb33dcc67666d3fea9d9d0`
- `test:cc28d39fceb2958e44dee93ad0395d04d1f545d2ae0739b96dc45ff2a2deec26`
- `test:e122dc20807941187a560fdc4f136f4521527bf3795527a0f61c8654c2efdc6f`

Tags:
- `investigation-report`

Contract:
- 完整所选 owner 树的资源根、owner、路径分量与目标文件均不得为符号链接，即使报告没有资源引用。

Proves:
- 真实文件系统的 root、owner、中间目录和文件初始替换均被资源验证器拒绝；资源字节读取计数为零。
