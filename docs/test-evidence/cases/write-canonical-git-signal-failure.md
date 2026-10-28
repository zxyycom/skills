### Case WRITE-CANONICAL-CASE-002: 进程信号失败后等待关闭

Tests:
- `test:d66c1394569f7607dbc59436563027691e8381728d37b19316f289fd69a45019`

Tags:
- `write-canonical`

Contract:
- 输入失败后的进程错误或信号失败不证明进程结束。

Proves:
- 注入 EPERM 事件和同步抛错，核对强制终止前锁保持及进程退出。
