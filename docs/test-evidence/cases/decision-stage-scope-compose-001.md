### Case DECISION-STAGE-SCOPE-COMPOSE-001: stage --scope domain composes with a previous index scope into the all snapshot

Tests:
- `test:e1152624a7332ab99be225417cfe30c512d5531027f9009c5688b53820ba8731`

Tags:
- `decision-records`

Contract:
- index 与 domain scope 可按序组合成与 all 等价的 pending 快照。

Proves:
- 先 index 后 domain 后，pending 索引字节与 index 结果一致，且所选 Markdown 进入 pending。
