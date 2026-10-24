### Case RECORD-READER-HANDLES-001: Node取消和消费失败关闭全部真实读取句柄

Tests:
- `test:4c900e86efdf569f32cb48e8c90bb771fe956e077617d372bca5dc6926c180b6`

Tags:
- `record-operations`

Contract:
- 取消和消费失败必须等待worker内已开始的同步读取及finally关闭完成，不能在句柄仍打开时返回。

Proves:
- 隔离Node调用真实生产worker和同步安全读取，以原生openSync/closeSync观察确认两次停止各读取64项、退出时零未关闭句柄。
