### Case RECORD-READER-ORDER-001: 批量安全读取保留输入顺序与强快照

Tests:
- `test:92a3430c87be2b06f6810c95bbec4925ce715fa2ffa9459e2c43736c67fa0060`

Tags:
- `record-operations`

Contract:
- 同一读取阶段的批量执行不能改变文本、完整身份、mode、父链与root/path绑定契约。

Proves:
- 真实worker逐项输出与原异步正文及快照相等，且错误事务根不能接纳已采集证明。
