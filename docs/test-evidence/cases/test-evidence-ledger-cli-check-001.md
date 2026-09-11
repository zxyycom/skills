### Case TEST-EVIDENCE-LEDGER-CLI-CHECK-001: Check CLI 输出机器失败并映射退出状态

Tests:
- `test:0342059ec579e821e52dfc4632e0b4826d65e29d7455becf7c24d94a11f4c656`

Tags:
- `test-evidence`

Contract:
- Check CLI 的领域失败必须以符合引用结果 schema 的 JSON 写入 stdout，并以非零退出码表示失败，不向 stderr 混入诊断。

Proves:
- 缺失、非 UTF-8 或超过 64 MiB 的显式快照文件均返回 snapshot-invalid JSON、空 stderr 与退出码 1。
