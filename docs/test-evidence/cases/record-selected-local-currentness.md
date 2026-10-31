### Case RECORD-SELECTED-LOCAL-CURRENTNESS-001: 局部同步只刷新所选当前来源

Tests:
- `test:479110cb41b07827ce503abc969d32e056a9a706c9b35eeec204999831fac90b`
- `test:cd84ec6133bb1baa241c89f122e1005cbb31d1f7d1b9ebdf2eee6dc77fa60606`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- selected sync 在合法发布基线上只验证所选与必要依赖，未选条目和revision保留发布事实，结果明确当前来源范围。

Proves:
- 无关正文变坏不阻断所选变化，所选title更新而未选entry/revision完全保持。
- coverage明确复合source、局部currentness与实际checkedIds；完整check仍拒绝无关坏正文。
