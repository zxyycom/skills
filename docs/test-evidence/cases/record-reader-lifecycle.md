### Case RECORD-READER-LIFECYCLE-001: 取消和消费失败收束worker

Tests:
- `test:c9ca47720fe930d5bf380479add0a5294234023e9b2b2878b591a47e69759296`

Tags:
- `record-operations`

Contract:
- worker调用遇消费失败或取消不能接受晚到成功；调用返回前关闭队列与所有在途读取。

Proves:
- 消费异常保持原错误，abort后回调数量不再增加，新调用实际读取取消后的字节。
