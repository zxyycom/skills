### Case RECORD-READER-PROTOCOL-001: 真实Node worker故障不退化为成功

Tests:
- `test:a49a5789876aef49d092188cb5efa942fa4cee7a40f9fd124210898c1902eb22`

Tags:
- `record-operations`

Contract:
- 线程提前退出或协议失效属于批次基础设施失败，不能映射为空集合或重试成功。

Proves:
- 隔离Node进程中的启动故障、提前退出和空协议回复均在零回调时拒绝；有效回复后的空闲退出仍使批次拒绝，不能报告完成。
