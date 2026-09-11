### Case INDEX-RUNTIME-SCHEMA-001: 暴露可组合的状态索引 schema

Tests:
- `test:b9792b8a99200344ffb5045462db3d1e27e9749f74022d70021145c6199df14e`

Tags:
- `index-runtime`

Contract:
- ID-keyed 直接 state entries 与结构化来源 revision 必须复用调用方 ID、fingerprint 和 state schema，并可导出 JSON Schema；record 的 Standard Schema 接口与 Valibot 解析一致。

Proves:
- 导出的 index 与 source-revision JSON Schema 都把调用方 ID 正则用于 record key，并保持对象结构。
- State-entry record 的 Valibot 与 Standard Schema 入口产生相同结果，并把 `__proto__` 和 `constructor` 保留为普通 own key。
- State-entry record 拒绝数组和非法 ID，source-revision record 拒绝非法 ID。
- 对 `__proto__.id` 的嵌套类型错误，两种接口保留完整路径；首个 record path item 的 `input` 与 `value` 分别严格引用原始 record 和原始 `__proto__` 成员。
