### Case INVESTIGATION-STAGE-DOMAIN-TREE-001: stage --scope domain writes the report and its complete owner resource tree

Tests:
- `test:04f890231f4e62763b910e09aaa4f2242f7da600660ef89639b2b0c79cc5ccbf`

Tags:
- `investigation-report`

Contract:
- domain scope 覆盖所选报告的完整 owner 资源树，成员取工作区、pending 与 HEAD 并集。

Proves:
- 引用成员修改、未引用与嵌套新增都进入 pending；索引与未选报告保持零变化。
