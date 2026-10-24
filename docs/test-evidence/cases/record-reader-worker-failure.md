### Case RECORD-READER-PROTOCOL-001: 真实Node worker故障不退化为成功

Tests:
- `test:a49a5789876aef49d092188cb5efa942fa4cee7a40f9fd124210898c1902eb22`

Tags:
- `record-operations`

Contract:
- 线程提前退出或协议失效属于批次基础设施失败，不能映射为空集合或重试成功。

Proves:
- 隔离 Node 进程中的启动故障、提前退出和空协议回复均使批次在零回调时拒绝。
- 有效回复的首个消费回调（consumer）进入后触发 worker 退出，批次仍拒绝且回调总数为一；剩余结果不会继续交付，也不报告完成。
