### Case INDEX-RUNTIME-SCHEMA-001: 暴露可组合的状态索引 schema

Entry:
- `tools/index-runtime/tests/runtime.test.ts > exposes a composable state-index schema`
- `bun test --test-name-pattern="^exposes a composable state-index schema$" ./tools/index-runtime/tests/run.ts`

Contract:
- ID-keyed stored entries 与结构化来源 revision 必须是复用调用方 ID、fingerprint 与 state schema 的对象 record，并可导出为 JSON Schema；stored-entry record 的 Standard Schema 接口必须与 Valibot 解析一致。

Proves:
- 导出的 index 与 source-revision JSON Schema 都把调用方 ID 正则用于 record key，并保持对象结构。
- Stored-entry record 的 Valibot 与 Standard Schema 入口产生相同结果，并把 `__proto__` 和 `constructor` 保留为普通 own key。
- Stored-entry record 拒绝数组和非法 ID，source-revision record 拒绝非法 ID。
- 对 `__proto__.state.id` 的嵌套类型错误，Valibot 与 Standard Schema 都保留完整路径；首个 record path item 的 `input` 与 `value` 分别严格引用原始 record 和原始 `__proto__` 成员，且 `input` 不包含 `:__proto__` own key。
