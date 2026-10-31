### Case DECISION-DISCARD-SPLIT-CLOSURE-001: Discard 拒绝会打开拆分闭包的后继

Tests:
- `test:e35b9f857b8e91b50546c91c70c6c7cb6bfef32a82beec86aa5006aee0ccae6c`

Tags:
- `decision-records`

Contract:
- 已建立拆分关系必须始终保有至少两个直接拆分后继；direct discard 不能删除其中一个后继而留下开放拆分。

Proves:
- 纯生命周期准备拒绝删除闭合拆分的一个后继，返回最终关系图一致性错误且结果不含 changes。
