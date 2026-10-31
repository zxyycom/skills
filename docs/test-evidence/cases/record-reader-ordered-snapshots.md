### Case RECORD-READER-ORDER-001: 批量安全读取保留输入顺序与强快照

Tests:
- `test:8678ca50a16a9fe3ab7fa330c4848a2386355c14680533d8a53db052f2fa1dc3`

Tags:
- `record-operations`

Contract:
- 同一读取阶段的批量执行不能改变文本、完整身份、mode、父链与root/path绑定契约。

Proves:
- 真实worker逐项输出与原异步正文及快照相等，且错误事务根不能接纳已采集证明。
