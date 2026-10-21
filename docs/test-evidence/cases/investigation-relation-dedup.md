### Case INVESTIGATION-RELATION-DEDUP-001: 关系证据按三元组去重并保留首次投影

Tests:
- `test:8f596e1b735ece3e54a51cf5b66e9632d1ac073295e1c25cba940bd3f93cf2ff`
- `test:a01c02ea94dcd668f3bda224ed352215f50fd979dd89dea6affcf7a0c59f07ec`
- `test:d199bba1ea029785c99f28137fdf9db601761d8756611715208b9827c2e687b3`

Tags:
- `investigation-report`

Contract:
- 关系筛选证据只按 `(sourceId, type, target)` 去重，summary 不参与身份；重复边保留首次投影，包括首次未提供 summary 的情形。
- type-only 归属来源记录；predecessors 由 anchor 指向结果，successors 由结果指向 anchor，both 与默认方向取并集；每条记录的证据按 UTF-16 三元组词法序输出。
- 去重状态只在单次筛选调用内有效，不影响同一上下文的后续调用或新快照。

Proves:
- 含多前序、逆序输入、重复边和摘要冲突的 type-only 归并投影保留全部不同 target、首次摘要及摘要缺失，不合并不同来源，并排除其他类型。
- 前驱、后继、显式 both 与默认 both 均保持完整方向事实及稳定证据顺序；同一 source/target 的不同类型不合并，同一结果中的反向边不合并，双向遇到的同一自环只保留一次。
- 同一上下文重复调用返回等价但独立的结果容器；新快照中相同三元组的更新摘要被返回，旧结果不变。
