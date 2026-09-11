### Case INDEX-RUNTIME-PERSISTED-SCHEMA-VERSION-001: 拒绝不兼容的持久化 Schema 版本

Tests:
- `test:b83b2dabbf15d28c406d87c1776582e6abc64705a5c130aa78a81c4554f8c99c`

Tags:
- `index-runtime`

Contract:
- Schema v4 parser 必须拒绝旧持久协议，而不能把包含 keys/wrapper 的旧结构当作当前 state-only 索引读取。

Proves:
- 将有效 schema v4 索引改为旧 `schemaVersion: 3` 后，解析返回 error 并报告 `state-index.schema-version-unsupported`。
