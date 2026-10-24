### Case TEST-EVIDENCE-LEDGER-CLI-ARGS-001: 公共 CLI 对用法错误使用 stderr 与退出码 2

Tests:
- `test:6046b9f35c3490d6a013f060ea8254aaf760ff4333a89adf7393ebeeefe70b84`
- `test:eacb4bb4481a47eb9cef84ec267eaa21e77230f2cd9626ce716f0c96f88b6f51`

Tags:
- `test-evidence`

Contract:
- 公共 CLI 的未知参数、缺失 show ID、重复或畸形 limit 都是 usage 错误，必须使用 stderr 且退出码为 2，而非输出领域 JSON。

Proves:
- 四类 usage 矩阵通过 source CLI 返回退出码 2、stdout 为空且 stderr 含 error；独立分发 unknown-option 代表在真实 Node 保持相同通道/退出码。
