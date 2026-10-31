### Case INVESTIGATION-LOCAL-RELATION-DEPENDENCIES-001: 关系闭合只消费发布图与所选来源

Tests:
- `test:a62b202641920e96ecb07a7e1db6076e4c0677f7a0b1ccee78b5a1c67e6225ef`

Tags:
- `investigation-report`

Contract:
- set-relations 从索引验证完整拆分事件，纯图依赖不读取当前正文。

Proves:
- 无关损坏正文不被读取；同一拆分事件未选 sibling 漂移不阻断所选来源更新，sibling 的发布状态与 revision 保持。
