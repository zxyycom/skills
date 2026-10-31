### Case WRITE-CANONICAL-CASE-008: 输入失败等待子进程结束

Tests:
- `test:a2e0e3a61fecb4027de1dbf95aa9a44f4227cff852e95d7528397376a68d89dd`

Tags:
- `write-canonical`

Contract:
- stdin 错误不能在子进程尚活时释放待提交锁。

Proves:
- 关闭输入并忽略 TERM，核对强制终止和锁内结算。
