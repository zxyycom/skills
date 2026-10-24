### Case DECISION-CANDIDATE-FORMAL-INDEX-PRESERVATION-001: 候选改名删除保持正式索引与未选候选

Tests:
- `test:13efd23a1fe6a3d2f158b90919e9726c1ca3fb2390efe66678e1f9e283f1ec09`

Tags:
- `decision-records`

Contract:
- 纯候选 rename/discard 以候选实际写集为提交点；正式索引只作为 guard，未选候选不自动改写关系。

Proves:
- CRLF 正式索引在候选 rename/discard 生效后保持 bytes、dev、inode 与 mode；候选更名后未选引用者仍保留旧 target，不被隐式修复。
