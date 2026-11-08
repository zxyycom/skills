### Case RECORD-SELECTED-IDENTITY-CORRECTION-001: 已知路径改身份必须同选旧新ID

Tests:
- `test:3d7ed27a8dbc8f22a7661346022083a7e8daf0af93519861725cbe452f4fd98c`

Tags:
- `decision-records`

Contract:
- DR 已知来源路径内身份更正须显式同选旧、新 ID。

Proves:
- 只选旧 ID 预检失败；同选旧新后提交，索引删除旧项并将新 ID 定位至原 a.md。
