### Case INVESTIGATION-MEMBER-SCAN-FRESH-001: 成员复核独立重取身份权限并保护排除路径安全

Tests:
- `test:362e4c7d658a996bea45e6cad3b5a10394ac3bfb750001f612a5ae12c6b51e7c`

Tags:
- `investigation-report`

Contract:
- 调查事务复核重新取得集合成员的身份与权限；显式可变路径（changedPaths）只排除成员等价比较，不跳过不安全类型检查。

Proves:
- 已采集成员的权限漂移与同名 inode 替换均使复核报成员变化错误。
- changedPaths 内的路径允许替换或缺失，但同路径变成符号链接仍报含目标路径的不安全成员错误。
