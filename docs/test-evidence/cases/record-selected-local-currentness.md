### Case RECORD-SELECTED-LOCAL-CURRENTNESS-001: 局部同步只刷新所选当前来源

Tests:
- `test:3d7ed27a8dbc8f22a7661346022083a7e8daf0af93519861725cbe452f4fd98c`

Tags:
- `decision-records`

Contract:
- DR selected sync 只刷新所选正文并保留未选发布 revision。

Proves:
- DR 局部同步修改的 A，预检 checkedIds 仅含 A；未读 B 的索引 revision 保持。
