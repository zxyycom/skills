### Case INDEX-RUNTIME-DEFINITION-001: 拒绝 definition version 已变化的持久化索引

Tests:
- `test:63e2eecdc4a2194d60a667558225c0f410aa9ee3ae8d2966e47d1c8fa9c669cf`

Tags:
- `index-runtime`

Contract:
- 查询字段 source/name/mode 或语义变化必须提升 `definitionVersion`；current load 以 namespace 与 definition version 绑定持久 state snapshot。

Proves:
- 字段改名并提升 definition version 后，旧 snapshot 以 `state-index.definition-version-mismatch` 拒绝。
