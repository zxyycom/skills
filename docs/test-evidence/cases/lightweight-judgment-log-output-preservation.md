### Case LIGHTWEIGHT-JUDGMENT-CLI-028: 发送后存储失败保留远端结果

Tests:
- `test:577954375d616804d292851eb888ec5172f5acf2e8ccc4c5891345d778262efb`

Tags:
- `lightweight-judgment`

Contract:
- 发送后的日志失败使用独立持久化状态与退出码，不丢弃已知服务结果、不把缺失行视为写入成功、不重发。

Proves:
- 更新触发器拒绝写入或调用行被删除时退出 4，meta.persistence 为 failed 且保留 callId；有效 answers 或远端 rate_limit 原错误仍在输出中，fetch 仅调用一次。
- 数据库分别保持 started 或无行，底层异常私有文本不进入 stderr。
