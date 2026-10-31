### Case INVESTIGATION-PUBLISH-CURRENT-DEPENDENCY-001: 发布保留未选依赖的当前正文

Tests:
- `test:41e72406a4792dbcaa0ab77c49ebffbe804020a6fc560a869639a7a9752f1f0c`

Tags:
- `investigation-report`

Contract:
- 普通发布按当前产品投影契约维护关系，不把未选正式依赖的正文锁定为准备时字节。

Proves:
- beforePublish 改未选依赖正文后普通 writer 成功发布候选，关系索引正确，依赖当前字节保留，原候选位置退出。
