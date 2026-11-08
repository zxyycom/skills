### Case DECISION-EVOLVE-DISCARD-001: Evolve 以最终关系删除已建立记录

Tests:
- `test:450da961340dd6df4f158bbc10af582ceee2ee87efe57ae661b47a036f93a2d0`

Tags:
- `decision-records`

Contract:
- evolve discard 和后继建立以同一最终关系图验收；关系指向将被删除的目标时不能提交。

Proves:
- 原生操作预检因后继仍指向待删除记录而拒绝，旧来源、候选和索引字节保持；显式清空后同次提交，旧来源及索引项消失，新来源 active 且索引关系为空。该节点不声称非空最终关系场景。
