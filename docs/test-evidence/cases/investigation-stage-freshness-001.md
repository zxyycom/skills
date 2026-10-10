### Case INVESTIGATION-STAGE-FRESHNESS-001: CLI 区分全量检查、索引暂存与局部来源门禁

Tests:
- `test:63ac0a55cbab184db8ac7e68c2ef83c061bafdb73a6451bc63ed910be547ec6d`

Tags:
- `investigation-report`

Contract:
- 全量 check 检查原文与发布投影；index stage 只暂存发布投影，domain stage 拒绝所选未发布来源变化。

Proves:
- title 变化使全量 check 失败，但 index stage 成功且不改变 pending；domain stage 拒绝来源变化；同步后 index stage 成功。
