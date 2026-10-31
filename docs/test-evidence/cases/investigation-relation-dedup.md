### Case INVESTIGATION-RELATION-DEDUP-001: 关系证据按三元组去重并保留首次投影

Tests:
- `test:2101a81365eb1154ff265c5079a31b14f8c3d2a27ba75782191f1940febe83a5`
- `test:5682309bb9b079e812b126804313f39462349a9c446dfa46501ac600f415f96f`
- `test:6065c3f18f80ed7deed8ef3b9f0261af5794f04859940f0a89338b066b0b95e3`

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
