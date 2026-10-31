### Case GATE-INVESTIGATION-CLI-OWNER-001: IR CLI 场景归真实 CLI consumer

Tests:
- `test:18ef9c17c16d092dec76c82b3f609a32c26a128f6d5a3836d2f61cbfd89170a1`

Tags:
- `repository-tooling`

Contract:
- CLI 场景测试字节只使其真实 CLI consumer 失效。

Proves:
- 三份 CLI 测试 leaf分别改动使 CLI-contract execute，index/query 与 transaction checks reuse。
