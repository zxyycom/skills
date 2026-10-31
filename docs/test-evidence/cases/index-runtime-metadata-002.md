### Case INDEX-RUNTIME-METADATA-002: 序列化解析并领域验证类型化元数据

Tests:
- `test:c4aa6917f148b06dd024469c0127d1313cfe84c7c349cf5ec6380f68c626e933`

Tags:
- `index-runtime`

Contract:
- 元数据序列化必须确定，解析必须同时通过协议 schema 与领域完整索引验证。

Proves:
- 合法 metadata 保留顺序；缺失/畸形协议字段、旧 schema 版本和领域拒绝分别返回 schema、版本或完整索引诊断。
