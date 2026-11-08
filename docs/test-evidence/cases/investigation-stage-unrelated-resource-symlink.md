### Case INVESTIGATION-STAGE-UNRELATED-RESOURCE-SYMLINK-001: 未选 owner 符号链接不阻断 domain 暂存

Tests:
- `test:cd4106b0c5e4d90db34cc976caf60a063d988e3ff335a732a88d91c791b9baa3`

Tags:
- `investigation-report`

Contract:
- 局部 domain 不把未选 owner 的符号链接作为所选记录的门禁或暂存对象。

Proves:
- Unix 真实 Git 中未选 owner 指向外部目录时 domain 暂存成功，链接未被暂存且链接与外部 sentinel 不变；此节点不以访问计数证明零读取。
