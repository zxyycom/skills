### Case NOVEL-CARDS-LAYOUT-014: 空集合与必需目录

Tests:
- `test:faa8bb7b0308fe4658a290b3aad608b3f17e585aaeb3762b6770e43c0eed3957`

Tags:
- `novel-cards`

Contract:
- cards必须真实存在，空集合合法；reference可以缺失但存在时不得为符号链接。

Proves:
- 空cards且缺reference可同步并核对当前索引；cards缺失以read-failed定位该目录，符号链接reference以source-path拒绝。
