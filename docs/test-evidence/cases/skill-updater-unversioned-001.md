### Case SKILL-UPDATER-UNVERSIONED-001: Check 报告未版本化安装

Tests:
- `test:c2225d3f2819fdc846cd10342b3b29483602e2839d9b4b3d23dd844559567a06`

Tags:
- `skill-updater`

Contract:
- 缺少有效版本 metadata 的已安装 skill 必须被明确标记为 unversioned。

Proves:
- Check 输出本地未版本化状态并与远端版本比较。
