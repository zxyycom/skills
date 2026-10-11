### Case DECISION-STAGE-FRESH-IDENTITY-DRIFT-001: 新鲜发现拒绝重复移动和删除重现

Tests:
- `test:1270ea9c854bc87bc39e547788fd877dc852b2768491ce61def50a4c69e71a5c`

Tags:
- `decision-records`

Contract:
- 写前应重新识别所选 ID 的唯一来源、位置和字节；删除项必须仍未出现，未选无效来源不进入本次失败范围。

Proves:
- 无关坏来源不阻断；重复 ID、仅路径移动、删除 ID 在他处重现、仅字节变化均被拒绝，确实未出现的删除通过。
