### Case NATIVE-RECORD-GIT-PATH-CONFLICT-001: Git 选中路径组件冲突

Tests:
- `test:03f81c90a14052c4b489757de1829b6a8b89c54a9ba3f9205f8cb226a7d34514`
- `test:85fc3c89015f1a68371f415a372efce1fe754f8cc2b2df6c32c3be0b7bc1b7f3`
- `test:960fc6eb100368d9d3a1fa98e8eca4b361806f310c8b974a8b004af4f8b54246`

Tags:
- `record-rust`

Contract:
- Git 暂存不得用路径祖先或后代冲突覆盖未选条目，显式选中删除可替换路径。

Proves:
- 真实 Git 分别核对双向组件冲突、选中删除替换以及相似文本前缀不误判。
