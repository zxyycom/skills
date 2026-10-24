### Case DECISION-DISCARD-INVALID-ESTABLISHED-SOURCE-001: 局部候选删除不验证未选正式正文

Tests:
- `test:ec58a8559ac3caa9df9cf303bae3dea0890a2e5802fdbc7e76552de498e71b55`

Tags:
- `decision-records`

Contract:
- discard 使用合法发布索引与所选候选，不替未选正式正文证明当前性。

Proves:
- 未选归档来源的 alignment 被外部改为 null 后，候选删除仍成功；该非法正文和正式索引原字节保持，所选候选确实退出。
