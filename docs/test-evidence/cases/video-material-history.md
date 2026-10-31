### Case VIDEO-MATERIAL-HISTORY-001: 独立材料累积与失败后的成功复用

Tests:
- `test:219005f13248e66fe40f3ce3923f88d5974f6fff377da67e889505479314a443`
- `test:387d85c5f8ed145b6e36500b38a06ad363039d79fa04bfdeb25bd800b312f37b`
- `test:e4300316941208425c9aa216ffbdd42d3400b1d056846be45079f9c6fef680bb`

Tags:
- `video-understanding`

Contract:
- 不同来源追加独立不可变材料；empty、failed、interrupted 与成功不同，最新有效成功材料在后续失败后仍可复用。

Proves:
- 外部字幕、显式 ASR 与 auto 候选逐次记录；失败不覆盖既有成功，真实空结果、解码失败和中断保持可区分状态。
