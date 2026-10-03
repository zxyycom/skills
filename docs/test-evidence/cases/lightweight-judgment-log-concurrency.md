### Case LIGHTWEIGHT-JUDGMENT-CLI-029: 独立进程并发追加

Tests:
- `test:226506e6b22ff8c8d7a51b59f505f8302a58bf9b2fc8c1e174f332334b21a262`

Tags:
- `lightweight-judgment`

Contract:
- 分发 MJS 在无工作区依赖的独立 Node 进程中可并发向同一 SQLite 库追加，不覆盖其他调用。

Proves:
- 八个独立 Node 进程使用临时目录中的 bundle 和模拟 fetch 同时调用，均退出 0、stderr 为空；输出 ID 各不相同并与八条 succeeded 记录严格对应，每行留有响应 BLOB。
