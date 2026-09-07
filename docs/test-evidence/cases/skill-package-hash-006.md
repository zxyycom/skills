### Case SKILL-PACKAGE-HASH-006: 从同一 pending 快照发现 skill 成员与内容

Tests:
- `test:70a94b3b88ae44dc4e307baca4e119c55aa9b904d662ec96469df6cfe338504d`

Tags:
- `repository-tooling`

Contract:
- Skill hash 与打包必须从同一版本管理 pending 快照恢复成员集合和包内文件，不能由工作区目录另行决定成员。

Proves:
- 已进入 pending、随后从工作区删除的完整 skill 仍被发现，并保留其暂存版本与文件内容。
- 只存在于工作区而未进入 pending 的 skill 不进入快照、hash 版本集合或版本基线判断。
