### Case INDEX-RUNTIME-SERIALIZATION-001: 序列化保留 definition-owned state 字段顺序

Tests:
- `test:3d3be087e5265e20985aec8cd761dbbf065b5fb90d499ba0f4d254ad4ccda372`

Tags:
- `index-runtime`

Contract:
- Definition 顺序模式只控制通用外壳与 parser 返回的 state/nested object 字段顺序；持久索引不保存查询字段描述或查询值，ID-keyed entries 保持确定性 ID 顺序。

Proves:
- Build、序列化、current load、reader 和严格 parse 均保留 state 字段顺序并按 ID 输出直接 state entry。
- 顶层不含 `keyDefinitions`，为 schema v4 文件添加旧持久字段会被严格 schema 拒绝。
