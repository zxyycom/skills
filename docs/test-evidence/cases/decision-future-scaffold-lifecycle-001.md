### Case DECISION-FUTURE-SCAFFOLD-LIFECYCLE-001: 未来关系候选可发现但不能提前发布

Tests:
- `test:c81af33136634b16a1baa5a94d42c5bffb480929737ebc869d8e05bf7b5f315c`

Tags:
- `decision-records`

Contract:
- 候选可声明未来关系，但 body-ready 不替代正式发布的目标与完整图校验。

Proves:
- body-ready 候选带未来目标仍被发现并有目标 warning；原生 publish 预检指出目标、拒绝提交，候选字节不变且不生成索引。此节点直接写入候选 fixture，创建入口独立由 candidate boundaries Case 承接。
