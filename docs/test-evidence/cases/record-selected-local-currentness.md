### Case RECORD-SELECTED-LOCAL-CURRENTNESS-001: 局部同步只刷新所选当前来源

Tests:
- `test:197a3d5444959b785a7b94aa0addbe2dc120cc22ae9e7b1efa166f418e9128be`
- `test:6568bdf36fafb3b7fbcb9df8cfab5c3d99809bab48af2f163c3a466bb8167d69`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- selected sync 在合法发布基线上只验证所选与必要依赖，未选条目和revision保留发布事实，结果明确当前来源范围。

Proves:
- 无关正文变坏不阻断所选变化，所选title更新而未选entry/revision完全保持。
- coverage明确复合source、局部currentness与实际checkedIds；完整check仍拒绝无关坏正文。
