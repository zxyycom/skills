### Case RECORD-READER-INPUT-TYPE-001: Node eval约束沿原异步读取执行

Tests:
- `test:ecd34cc5540875593502636d54554a06ee4a3b5657ad06a5df0d49761a6ea9f4`

Tags:
- `record-operations`

Contract:
- 父进程--input-type与file-backed worker不兼容时，批量读取预先选择本进程原异步合同，不在worker失败后重试。
- 测试外层20秒与子进程15秒预算仅约束测试执行和收尾，不构成产品性能或延迟保证。

Proves:
- 真实Node --input-type=module消费者成功读取1000项原文本、未创建worker，即使安装内worker入口会直接抛错也不触发。
- 本入口证明上述正常完成路径，不覆盖子进程超时故障注入。
