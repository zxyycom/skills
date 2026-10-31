### Case LIGHTWEIGHT-JUDGMENT-CLI-029: 独立进程并发追加

Tests:
- `test:8204fdd0296ad1035aaab4baf2f7308f87ff0315444b56f7401f029db858c3c2`

Tags:
- `lightweight-judgment`

Contract:
- 分发 TS 在已有兼容依赖的独立 Node 进程中可并发向同一 SQLite 库追加，不覆盖其他调用。

Proves:
- 八个独立 Node 进程使用临时目录中的 TS 运行时 和模拟 fetch 同时调用，均退出 0、stderr 为空；输出 ID 各不相同并与八条 succeeded 记录严格对应，每行留有响应 BLOB。
