### Case RECORD-READER-HANDLES-001: Node取消和消费失败关闭全部真实读取句柄

Tests:
- `test:2d4a3c45e79d69615be2d820f404fda1ff6fb820b6c2542632e500baea94a613`

Tags:
- `record-operations`

Contract:
- 取消和消费失败必须等待worker内已开始的同步读取及finally关闭完成，不能在句柄仍打开时返回。

Proves:
- 隔离Node调用真实生产worker和同步安全读取，以原生openSync/closeSync观察确认消费失败和取消两次均实际读取文件，且调用返回前worker退出、零未关闭句柄；不以单块恰好读取多少项判定关闭正确性。
