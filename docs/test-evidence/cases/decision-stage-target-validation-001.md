### Case DECISION-STAGE-TARGET-VALIDATION-001: Stage 拒绝关系目标无效的候选

Tests:
- `test:39f6c85324ec6964f5a2f7b7a35b88cd2e14cc2928d6f7837ffa3c759c11576a`

Tags:
- `decision-records`

Contract:
- 候选的关系目标无效时 stage 不得写入 pending。

Proves:
- 纯 stage index 构造拒绝缺失 relation target 的候选，并返回指明 missing-target 的 error；不调用 pending 写入。
