### Case INVESTIGATION-LOCAL-RELATION-DEPENDENCIES-001: 关系闭合只消费发布图与所选来源

Tests:
- `test:744fbe3b2806a63e6adc3bd9e3bc0283004bee11f713a517a5515698427d2428`

Tags:
- `investigation-report`

Contract:
- set-relations 从索引验证完整拆分事件，纯图依赖不读取当前正文。

Proves:
- 无关损坏正文不被读取；同一拆分事件未选 sibling 漂移不阻断所选来源更新，sibling 的发布状态与 revision 保持。
