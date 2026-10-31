### Case VERSION-CONTROL-CONTENT-PAYLOAD-FINGERPRINT-001: 选中实际payload指纹独立于OID

Tests:
- `test:1bd5275949f2be1e2547831064ef07f6209e1a07becd36eeab5aa0fc20553a6c`

Tags:
- `version-control`

Contract:
- content-paths对所选payload验证完整实际字节并保存指纹，不能仅以相同Git OID作为实际字节未变的依据。

Proves:
- 保留相同OID但改写合法blob实际payload后，快照比较与锁内CAS均拒绝。
