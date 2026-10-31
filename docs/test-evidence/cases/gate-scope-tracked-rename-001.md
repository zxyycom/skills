### Case GATE-SCOPE-TRACKED-RENAME-001: 未暂存的记录模块重命名保持增量范围闭合

Tests:
- `test:1895bfadee6d42fd5bc7ffed19f2b2725d8454fa4fb0079b7e7dadae565ef10f`

Tags:
- `repository-tooling`

Contract:
- 重组记录工具目录时，Git index 中尚未退出的旧路径与当前新路径都保留原有能力归属；不能依赖全量回退掩盖缺失的输入证明。

Proves:
- 在真实隔离 Git index 中暂存十六组源码、测试与共享 helper 的旧路径，逐一只在磁盘重命名；快照确认旧路径为 missing、新路径为 file，且没有未归属输入。
- 每次重命名只激活实际订阅者，无关领域继续复用；成功证明可发布，随后的相同输入全部复用。
