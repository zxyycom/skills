### Case WRITE-CANONICAL-CASE-008: 输入失败等待子进程结束

Tests:
- `test:28e0e9759d488857acf0235dee751a380e51656e3781d236304b737207fa2a95`

Tags:
- `write-canonical`

Contract:
- stdin 错误不能在子进程尚活时释放待提交锁。

Proves:
- 关闭输入并忽略 TERM，核对强制终止和锁内结算。
