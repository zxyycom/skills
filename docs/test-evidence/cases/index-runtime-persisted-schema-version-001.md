### Case INDEX-RUNTIME-PERSISTED-SCHEMA-VERSION-001: 拒绝不兼容的持久化 Schema 版本

Tests:
- `test:91db7e974159c556cb85c36ee6c9c851a89a36907f58f98cb57325606e17acf3`

Tags:
- `index-runtime`

Contract:
- Schema v4 parser 必须拒绝旧持久协议，而不能把包含 keys/wrapper 的旧结构当作当前 state-only 索引读取。

Proves:
- 将有效 schema v4 索引改为旧 `schemaVersion: 3` 后，解析返回 error 并报告 `state-index.schema-version-unsupported`。
