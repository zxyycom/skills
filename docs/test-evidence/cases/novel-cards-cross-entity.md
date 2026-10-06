### Case NOVEL-CARDS-CROSS-ENTITY-021: 跨对象完整版本变迁

Tests:
- `test:459806db18d6d3c9ccd386f2ed94dfef0f86fffd5334aeffb567da538ec05898`

Tags:
- `novel-cards`

Contract:
- 显式write批量变迁一次关联多个对象；当前ID与精确版本引用独立，原卡完整归档后移动仍可定位。

Proves:
- 缺write不修改；一次应用同时更新人物与设定并按对象、事件和变迁查询前后版本；完整原Markdown与移位快照仍按id@N读取。
