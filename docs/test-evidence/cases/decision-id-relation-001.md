### Case DECISION-ID-RELATION-001: 关系跨根目录和归档解析

Tests:
- `test:f4d1c48ac3f4267f9242e4c986f56b66304f426bbd14a383bee847ef013f277b`

Tags:
- `decision-records`

Contract:
- 关系 target 使用 extensionless 稳定 ID，不依赖 root/archive 物理位置，并能跨两种位置解析；可选 summary 仅描述该边。

Proves:
- 激活 candidate 后原 active 归档，索引保留 candidate 到该 ID 的 relation summary，trace 的 entry relations 原样投影该摘要。
