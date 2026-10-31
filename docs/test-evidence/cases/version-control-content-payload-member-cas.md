### Case VERSION-CONTROL-CONTENT-PAYLOAD-CAS-001: 选择性payload仍保护完整成员身份

Tests:
- `test:0aa5ac14496b379a09d1ce096d5adc948af49ed625ab23a98080bd8c36cab481`
- `test:3491a4f4cf8da3e89417322bd2f9e885e90d0c3bed91007a458c69623261fdd4`
- `test:666271291c1c18e1bbb6af0aad4588a39c9eded8702948b7e8f9dd5036ebbc73`

Tags:
- `version-control`

Contract:
- content-paths只收窄payload验收，不收窄完整pending路径、模式与OID比较和锁内CAS。

Proves:
- 未选OID、模式或成员漂移导致精确比较、同阶段扩展比较失败且锁内替换拒绝，当前index不被发布覆盖。
