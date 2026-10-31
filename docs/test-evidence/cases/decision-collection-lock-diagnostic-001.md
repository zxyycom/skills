### Case DECISION-COLLECTION-LOCK-DIAGNOSTIC-001: 集合锁只把已存在的锁报告为 busy

Tests:
- `test:65ec4ba04e2a39a51b136782e5cb2efae8903bedb5d7388fe6286c60fef16cf2`

Tags:
- `decision-records`

Contract:
- Decision Records collection mutation lock 只有 exclusive create 确认 `EEXIST` 时才表示 busy；访问拒绝和未知 I/O 必须保留各自可行动诊断，且未取得锁时不写入。

Proves:
- `EEXIST` 失败输出 `decision-records.collection-lock-busy` 和 `causeCategory: busy`。
- `EACCES` 输出 access-denied 诊断，未知 I/O 不伪称 busy，三种情况都保持 stdout 为空并退出失败。
