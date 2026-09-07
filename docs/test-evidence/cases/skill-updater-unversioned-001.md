### Case SKILL-UPDATER-UNVERSIONED-001: Check 报告未版本化安装

Tests:
- `test:d891eac11bd4ad7ee784dff5c2ec3d99915f4f4e92741ac6ef97b23d4307bf41`

Tags:
- `skill-updater`

Contract:
- 缺少有效版本 metadata 的已安装 skill 必须被明确标记为 unversioned。

Proves:
- Check 输出本地未版本化状态并与远端版本比较。
