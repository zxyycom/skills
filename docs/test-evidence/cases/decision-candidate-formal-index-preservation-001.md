### Case DECISION-CANDIDATE-FORMAL-INDEX-PRESERVATION-001: 候选改名删除保持正式索引与未选候选

Tests:
- `test:014060b4dc094c98d7e1d700a1a1b5428288cfee3971f94d20fc291fc5265635`

Tags:
- `decision-records`

Contract:
- 纯候选 rename/discard 以候选实际写集为提交点；正式索引只作为 guard，未选候选不自动改写关系。

Proves:
- CRLF 正式索引在候选 rename/discard 生效后保持 bytes、dev、inode 与 mode；候选更名后未选引用者仍保留旧 target，不被隐式修复。
