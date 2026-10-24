### Case GATE-INVESTIGATION-CLI-OWNER-001: 迁移 IR CLI 场景归真实 CLI consumer

Tests:
- `test:24b18f552fb3dfb3b388a93ef38bc9ffe934fe66bc0fa105e39e3c570375306e`

Tags:
- `repository-tooling`

Contract:
- CLI 场景测试字节只使其真实 CLI consumer 失效。

Proves:
- 三份迁移叶子分别改动使 CLI-contract execute，index/query 与 transaction checks reuse。
