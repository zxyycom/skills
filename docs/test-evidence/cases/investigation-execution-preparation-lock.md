### Case INVESTIGATION-EXECUTION-PREPARATION-LOCK-001: 正式更名锁内准备而预检无锁

Tests:
- `test:72172cf8c31c57d36b1e3c986ad78513a251174e43b2e7af91f59be9e02dc8db`

Tags:
- `investigation-report`

Contract:
- IR rename 显式preflight完整只读无锁，正式执行仅轻量入口核对后取得锁并完整准备一次。

Proves:
- 忙锁和无关坏正文并存时，正式执行报告lock-busy，预检返回正文领域错误而非锁忙且index不变。
- 有效正式更名的全部正文open发生在锁存在期间，实际旧文件退出且新文件声明新ID。
