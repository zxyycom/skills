### Case NATIVE-RELEASE-STAGING-001: 原生输入在独占目录中暂存

Tests:
- `test:581578fa88e4b805d9d5a899d4b5c84194284ab0625bb6bc99c173cece50a354`

Tags:
- `repository-tooling`

Contract:
- 原生候选输入暂存不能清除或覆盖已有 dist 输出；源码摘要不匹配时不能产生成功准备结果。

Proves:
- 私有 Git fixture 的源码、冻结生成输入和当前基础 skill 包写入新 staging，已有 dist sentinel 保持不变。
- 摘要错配被拒绝且 sentinel 仍保持；此测试不证明正式原生资产或发布链路。
