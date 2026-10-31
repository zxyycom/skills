### Case INDEX-RUNTIME-PERSISTED-SCHEMA-VERSION-001: 拒绝不兼容的持久化 Schema 版本

Tests:
- `test:561df8bbf7b82a93bb4f3a5fd4c6d973684a5bd8fabbc0c1da5ee1665729f5bc`

Tags:
- `index-runtime`

Contract:
- Schema v4 parser 必须拒绝旧持久协议，而不能把包含 keys/wrapper 的旧结构当作当前 state-only 索引读取。

Proves:
- 将有效 schema v4 索引改为旧 `schemaVersion: 3` 后，解析返回 error 并报告 `state-index.schema-version-unsupported`。
