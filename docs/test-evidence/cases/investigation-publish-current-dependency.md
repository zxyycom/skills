### Case INVESTIGATION-PUBLISH-CURRENT-DEPENDENCY-001: 发布保留未选依赖的当前正文

Tests:
- `test:f269cde7cdd061bf1d5d64ce688d89873cdf13fd721dae5b705150af6fd74724`

Tags:
- `investigation-report`

Contract:
- 普通发布按当前产品投影契约维护关系，不把未选正式依赖的正文锁定为准备时字节。

Proves:
- beforePublish 改未选依赖正文后普通 writer 成功发布候选，关系索引正确，依赖当前字节保留，原候选位置退出。
