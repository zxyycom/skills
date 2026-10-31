### Case RECORD-READER-PROTOCOL-001: 真实Node worker故障不退化为成功

Tests:
- `test:404159a5336d1beeedcc40150344b4e1ed6968d2a06ff2dd86e4bc3fa3b6f1e1`

Tags:
- `record-operations`

Contract:
- 线程提前退出或协议失效属于批次基础设施失败，不能映射为空集合或重试成功。

Proves:
- 隔离 Node 进程中的启动故障、提前退出和空协议回复均使批次在零回调时拒绝。
- 有效回复的首个消费回调（consumer）进入后触发 worker 退出，批次仍拒绝且回调总数为一；剩余结果不会继续交付，也不报告完成。
