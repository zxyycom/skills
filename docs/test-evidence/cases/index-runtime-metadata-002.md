### Case INDEX-RUNTIME-METADATA-002: 序列化解析并领域验证类型化元数据

Tests:
- `test:931200b47ee267c2cbad34f931a6d312203d1509a0977437a7a6c168a770afc6`

Tags:
- `index-runtime`

Contract:
- 元数据序列化必须确定，解析必须同时通过协议 schema 与领域完整索引验证。

Proves:
- 合法 metadata 保留顺序；缺失/畸形协议字段、旧 schema 版本和领域拒绝分别返回 schema、版本或完整索引诊断。
