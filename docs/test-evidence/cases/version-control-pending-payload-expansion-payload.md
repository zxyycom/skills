### Case VERSION-CONTROL-PENDING-PAYLOAD-EXPANSION-PAYLOAD-001: payload 扩展比较旧选择的实际字节

Tests:
- `test:5dfcc0e315ed4b463648f56f69fcb6df594f8d9edb7c3697af31200425b40909`

Tags:
- `version-control`

Contract:
- 同阶段扩展不能只依赖 OID，先前选择的实际 payload 指纹必须保持。

Proves:
- 保持所选 OID 不变并更换合法 blob payload 后，新读扩展比较明确失败。
