### Case GATE-QUICK-RECEIPT-ISOLATION-001: quick 不准备工作区或发布完整证明

Tests:
- `test:269843753f2c9a414c23e88ac3118450d769413f9d15395d8f745337f67aa9c3`

Tags:
- `repository-tooling`

Contract:
- 默认 quick 不调用全工作区输入准备或读取完整 receipt；不发布或清理既有完整证明，也不冒发增量摘要。

Proves:
- 默认调用向 Definition 传入 quick 与 null plan，无 activeToolIds 或 selectionScopes，执行 controls 保持空 flags；会抛出不可读工作区错误的准备器从未调用。
- 发布器调用数为零，旧 receipt 字节保持不变，gate-incremental.json 不存在；原生通过时退出 0。
- quick 日志明确仅为固定必要基线，建议按当前任务追加 --scope 能力组，不再暗示日常必须运行 check:changed。
