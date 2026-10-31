### Case INVESTIGATION-LAZY-SELECTOR-001: 缺失与歧义选择器在构图前返回诊断

Tests:
- `test:3fbd732d385efb423ab8f3e4fe6823f76d6625abb95686b11479df1479ea21d0`

Tags:
- `investigation-report`

Contract:
- 未知或歧义 selector 必须保留原错误语义，并在图构建之前失败。

Proves:
- missing 与歧义 same selector 在筛选/trace 入口给出一致错误，显式 graph provider 的调用数为零。
