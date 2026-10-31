### Case VERSION-CONTROL-PENDING-PAYLOAD-EXPANSION-PAYLOAD-001: payload 扩展比较旧选择的实际字节

Tests:
- `test:d2788279793bd921ce1ebc1468eaa8a9d834f74d945900e0f5bf0a1dcbef6a9f`

Tags:
- `version-control`

Contract:
- 同阶段扩展不能只依赖 OID，先前选择的实际 payload 指纹必须保持。

Proves:
- 保持所选 OID 不变并更换合法 blob payload 后，新读扩展比较明确失败。
