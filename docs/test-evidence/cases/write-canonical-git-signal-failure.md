### Case WRITE-CANONICAL-CASE-002: 进程信号失败后等待关闭

Tests:
- `test:757785140627af4c9721c7132588cd8a755d71f5938c1de87956f5184891ae8a`

Tags:
- `write-canonical`

Contract:
- 输入失败后的进程错误或信号失败不证明进程结束。

Proves:
- 注入 EPERM 事件和同步抛错，核对强制终止前锁保持及进程退出。
