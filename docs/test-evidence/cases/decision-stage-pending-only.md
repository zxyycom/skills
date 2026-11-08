### Case DECISION-STAGE-PENDING-ONLY-001: Stage 清理可定位旧路径并拒绝失定位 pending 身份

Tests:
- `test:03034790385829750e25b4525fbca4591b204d67096a0778e926677d422aa943`
- `test:964e255edf614465843bd9de4c850235cb8ccb35d91e9c1823456591a1b8bf39`

Tags:
- `decision-records`

Contract:
- stage 可按可信 locator 定位并清理 pending-only 来源；失去可信定位时拒绝，恢复 locator 后可清理。

Proves:
- 真实 Git 中 pending-only 日期来源从工作区删除后，all 清除 canonical pending 路径；任意 basename 失去 H/W/P 索引定位时 domain 拒绝且 pending 不变，恢复 P 索引后清除旧路径并保留该索引与未选 pending。
