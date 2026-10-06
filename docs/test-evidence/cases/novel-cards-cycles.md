### Case NOVEL-CARDS-CYCLES-004: 无环且不固定层数

Tests:
- `test:6ae3d44f287a3156830c676fce251cd03605e22f85e9a27edd6d01d61f6bded6`

Tags:
- `novel-cards`

Contract:
- children必须无环，存储模型没有卷册章固定层级或卡图深度上限。

Proves:
- 120层合法卡图通过；增加回边后children-cycle失败。
