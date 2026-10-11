### Case DECISION-TRACE-RENDER-BASELINE-001: 渲染字节保留历史 owner 与上下文摘要

Tests:
- `test:1e6f826bd468b4a381c9d8d0af38a4bef0aeb80d4f17990e1833a6c206a56489`

Tags:
- `decision-records`

Contract:
- renderer 只解释既有切片，不改变事件归属、稳定顺序、摘要转义、覆盖和成员事实；发布 Source 行是独立快照语义变化。

Proves:
- 对基线实际 renderer 生成的七份完整 goldens，chain/unlayered、split、多事件、重划 context、两种历史 owner 陷阱与重叠 context 边除新增 Source 行外逐字节一致。
