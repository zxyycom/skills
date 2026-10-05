### Case VERSION-CONTROL-PENDING-REPRESENTATION-001: 保真替换可执行文件与符号链接快照

Tests:
- `test:217b40fe8bb0913d2d16bd6a5d2944986a1a3a5137406adc4e949d42d6dfb1aa`

Tags:
- `version-control`

Contract:
- 共享 pending 快照保存路径、字节与文件表示，按显式目标表示替换并只复用完全一致的条目。

Proves:
- 同一路径与字节的可执行及符号链接快照可以直接作为期望与目标，无变化时不调用写入 hook。
- 修改已有可执行文件并新增可执行文件后，读回字节与 kind 等于目标，Git 分别保持 100755 和 120000。
