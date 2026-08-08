### Case INDEX-RUNTIME-SPECIAL-ID-001: 原型敏感 ID 经 Schema 与 Runtime 安全往返

Entry:
- `tools/index-runtime/tests/runtime.test.ts > round-trips prototype-sensitive ids through schemas and runtime`
- `bun test --test-name-pattern="^round-trips prototype-sensitive ids through schemas and runtime$" ./tools/index-runtime/tests/run.ts`

Contract:
- Schema v3 的 ID record 必须把 `constructor`、`prototype` 与 `__proto__` 作为普通 own key，并在 build、序列化解析、公共 schema 与 runtime 查询之间保留其身份和值。

Proves:
- Build 向领域 parser 传入全部三个身份；built index 将 `__proto__` 保留为 own key，且 stored entry 只包含 `keys` 与 `state`。
- 公共 source-revision schema 的 Valibot 与 Standard Schema 路径产生相同 record 并保留原型敏感键；公共 index schema 同样保留这些键，并拒绝嵌套 label 类型错误。
- 序列化索引解析成 reader 后，`get("__proto__")` 返回对应状态，按 ID 查询返回排序后的全部三个身份。
