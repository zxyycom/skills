### Case NATIVE-RECORD-RESOURCE-OWNER-REFERENCE-001: 资源 owner 的直接引用

Tests:
- `test:d6feac5fd67279c73c739426c51968dd9567a460ced83725dd9c4d1b282460bc`

Tags:
- `record-rust`

Contract:
- 资源 owner 必须直接引用归属它的资源，缺失时报告该资源。

Proves:
- 固定资源集合缺少首项时报告首项；补齐后校验通过。
