### Case VIDEO-MATERIAL-HISTORY-001: 独立材料累积与失败后的成功复用

Tests:
- `test:38b7f9f0bd82b3c0ee7bf6daec13999442daff1b18e8464005ac71a271c1b032`
- `test:8b767128e6a2035c298f4e6311ca457be64a61048504eb39a6c4ca10c0f8ffb9`
- `test:c61a0486695bc323d49246fc96dd584af4220384f5cf3e5dee24662267627c1f`

Tags:
- `video-understanding`

Contract:
- 不同来源追加独立不可变材料；empty、failed、interrupted 与成功不同，最新有效成功材料在后续失败后仍可复用。

Proves:
- 外部字幕、显式 ASR 与 auto 候选逐次记录；失败不覆盖既有成功，真实空结果、解码失败和中断保持可区分状态。
