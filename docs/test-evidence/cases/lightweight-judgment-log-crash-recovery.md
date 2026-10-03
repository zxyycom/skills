### Case LIGHTWEIGHT-JUDGMENT-CLI-030: 强制终止后的记录恢复

Tests:
- `test:d095df0dd4f9a186d8f1abdc14b48c511079921a5b7080f09c1452a6f45b2bbf`

Tags:
- `lightweight-judgment`

Contract:
- 进程终止不抹去已经提交的发送意图或收到的正文；后续调用不自动重放不完整记录。

Proves:
- 独立 Node 进程在 mock fetch 内 SIGKILL 后，另一个连接可读到 started 与请求正文；收到正文后、最终状态提交前 SIGKILL 则留下 response_received 与确切字节，finished_at 仍为 NULL。
- 再运行一次正常调用只新增一条 succeeded，先前两条不完整记录保持原样；该测试不证明真实服务结果或断电恢复。
