### Case INDEX-RUNTIME-DEFINITION-001: 拒绝 definition version 已变化的持久化索引

Tests:
- `test:003a78c37e02c6ebbbc212bb959f4319a335cc3e5cd8e322e88a06a89d95c01b`

Tags:
- `index-runtime`

Contract:
- 查询字段 source/name/mode 或语义变化必须提升 `definitionVersion`；current load 以 namespace 与 definition version 绑定持久 state snapshot。

Proves:
- 字段改名并提升 definition version 后，旧 snapshot 以 `state-index.definition-version-mismatch` 拒绝。
