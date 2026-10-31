### Case DECISION-STAGE-ALL-LOCATOR-PARSE-REUSE-001: all 暂存复用已验 locator 索引解析

Tests:
- `test:d11489bbe78535815bdd00328736021ebeed466d981667679bdb92047fc47282`

Tags:
- `decision-records`
- `index-runtime`

Contract:
- all 暂存在准备和写前复核（fresh）阶段独立取得真实工作区（W）与暂存区（P）事实。
- 本阶段从定位用索引（locator）扩展到最终暂存区快照时，完整成员的路径、mode、OID 及已读内容未变，才可复用已验索引解析。

Proves:
- 准备和 fresh 共实际读取 W 索引两次；索引文本未变时仅解析一次。
- HEAD 与 P 索引文本相同且不同于 W 时，该文本共解析三次，分别用于固定 HEAD 和两阶段各自的 locator，准备阶段扩展后的快照不再解析该索引。
- 发布后的暂存区索引接纳所选 A 的新标题，保留未选 B 的原发布标题。
