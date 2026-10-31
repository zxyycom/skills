### Case INVESTIGATION-EXECUTION-PREPARATION-LOCK-001: 正式更名锁内准备而预检无锁

Tests:
- `test:b76cefa93fd2b49ebd5a64fac8e6caab7618cc2a2c03d730e8ebceccb3e2535d`

Tags:
- `investigation-report`

Contract:
- IR rename 显式preflight完整只读无锁，正式执行仅轻量入口核对后取得锁并完整准备一次。

Proves:
- 忙锁和无关坏正文并存时，正式执行报告lock-busy，预检返回正文领域错误而非锁忙且index不变。
- 有效正式更名的全部正文open发生在锁存在期间，实际旧文件退出且新文件声明新ID。
