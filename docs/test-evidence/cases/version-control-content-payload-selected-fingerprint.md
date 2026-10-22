### Case VERSION-CONTROL-CONTENT-PAYLOAD-FINGERPRINT-001: 选中实际payload指纹独立于OID

Tests:
- `test:5d9367fe9e350d8241dab079f2d00f11e00642db4287741826e0c00df114c8fa`

Tags:
- `version-control`

Contract:
- content-paths对所选payload验证完整实际字节并保存指纹，不能仅以相同Git OID作为实际字节未变的依据。

Proves:
- 保留相同OID但改写合法blob实际payload后，快照比较与锁内CAS均拒绝。
