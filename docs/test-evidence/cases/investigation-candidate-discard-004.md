### Case INVESTIGATION-CANDIDATE-DISCARD-004: 正式删除不审计未选候选引用

Tests:
- `test:6704f980a81e6b024efc0cd44b5f231a6d620e1a0ba149ca89105ca3abe0f99d`

Tags:
- `investigation-report`

Contract:
- 正式 discard 的引用保护来自发布索引，未选候选内容非法不扩大删除事务。

Proves:
- 候选正文不可解析时，授权删除正式 owner 及资源仍成功，未选候选字节保留。
