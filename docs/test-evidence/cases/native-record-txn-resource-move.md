### Case NATIVE-RECORD-TXN-RESOURCE-MOVE-001: 资源目录先移动再更新引用

Tests:
- `test:00096300802c4f2af731ae4aa4ffb9d5680cdd42997d2f02ee4e3dd95038aa46`

Tags:
- `record-rust`

Contract:
- 资源目录移动和引用写入按计划顺序执行。

Proves:
- 私有目录核对资源新旧位置、内容以及资源与引用路径的报告顺序。
