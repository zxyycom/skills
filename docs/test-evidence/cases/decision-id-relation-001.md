### Case DECISION-ID-RELATION-001: 关系跨根目录和归档解析

Tests:
- `test:b6ec8a1db70f0ddbc211e0fe0e245af219bedeb236e6feff6af700ab1f0486ef`

Tags:
- `decision-records`

Contract:
- 关系 target 使用 extensionless 稳定 ID，不依赖 root/archive 物理位置，并能跨两种位置解析；可选 summary 仅描述该边。

Proves:
- 激活 candidate 后原 active 归档，索引保留 candidate 到该 ID 的 relation summary，trace 显示摘要。
