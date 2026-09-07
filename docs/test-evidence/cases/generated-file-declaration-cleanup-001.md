### Case GENERATED-FILE-DECLARATION-CLEANUP-001: 声明树清理只移除已验证的过期文件

Tests:
- `test:e4a7ca0f9372d6584df5e2f2c8f9e26c866e6c3d15472d19cb391fed8689b373`

Tags:
- `repository-tooling`

Contract:
- 生成声明树只能清理不在当前闭包中、直接普通且带本生成器 header 的 `.d.mts` 文件；其他成员必须保留、报告手动处置并使构建失败。

Proves:
- check 报告可验证 stale 声明与不受支持成员；write 只删除 stale 声明，保留当前声明、手写声明、目录和符号链接，同时维持失败状态。
