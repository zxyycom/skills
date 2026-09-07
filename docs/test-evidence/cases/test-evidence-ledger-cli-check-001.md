### Case TEST-EVIDENCE-LEDGER-CLI-CHECK-001: Check CLI 输出机器失败并映射退出状态

Tests:
- `test:cd5bcb2e2c1c8752626b62ad5f4cd3d2f944be5ff06ba9f4cce512394a6c9e3e`

Tags:
- `test-evidence`

Contract:
- Check CLI 的领域失败必须以符合引用结果 schema 的 JSON 写入 stdout，并以非零退出码表示失败，不向 stderr 混入诊断。

Proves:
- 缺失、非 UTF-8 或超过 64 MiB 的显式快照文件均返回 snapshot-invalid JSON、空 stderr 与退出码 1。
