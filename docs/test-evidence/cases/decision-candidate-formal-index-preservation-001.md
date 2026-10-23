### Case DECISION-CANDIDATE-FORMAL-INDEX-PRESERVATION-001: 候选改名删除不发布既有正式索引

Tests:
- `test:13efd23a1fe6a3d2f158b90919e9726c1ca3fb2390efe66678e1f9e283f1ec09`

Tags:
- `decision-records`

Contract:
- 纯候选 rename/discard 的实际提交点属于候选文件写集；既有正式索引仅作为受保护 guard，不得为统一事务而规范化或重新发布。

Proves:
- 含正式成员且正式 index 使用 CRLF 表示与指定 mode 时，SDK candidate rename 和 CLI candidate discard 真实生效。
- 每次候选动作后正式 index 的原始 bytes、dev、inode 与 mode 全部保持，不被 LF serialization 替换。
