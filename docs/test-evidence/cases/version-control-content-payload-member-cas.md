### Case VERSION-CONTROL-CONTENT-PAYLOAD-CAS-001: 选择性payload仍保护完整成员身份

Tests:
- `test:5df9539bd1b91ae1d83897a7b539efd797492227135d56e21c5622af70b31a0b`
- `test:7771171c7c6e0c4c54bc2751c1219971925d6e30034491c17e4ee395a387acba`
- `test:a1ce2cf3ef8baf4c2bdddfe3828bf59070f0ce52f964b2f5b9346c6dd50d8566`

Tags:
- `version-control`

Contract:
- content-paths只收窄payload验收，不收窄完整pending路径、模式与OID比较和锁内CAS。

Proves:
- 未选OID、模式或成员漂移导致快照比较失败且锁内替换拒绝，当前index不被发布覆盖。
