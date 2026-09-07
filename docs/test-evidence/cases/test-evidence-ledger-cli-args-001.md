### Case TEST-EVIDENCE-LEDGER-CLI-ARGS-001: 公共 CLI 对用法错误使用 stderr 与退出码 2

Tests:
- `test:e9a1ab88fdf23ef343e1b640ea22d320690ea69e6256035033dc358ac865aaef`

Tags:
- `test-evidence`

Contract:
- 公共 CLI 的未知参数、缺失 show ID、重复或畸形 limit 都是 usage 错误，必须使用 stderr 且退出码为 2，而非输出领域 JSON。

Proves:
- 四类用法输入均以退出码 2 结束、stdout 为空且 stderr 含 `error:`。
