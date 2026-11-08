### Case INVESTIGATION-RENAME-FORMAL-001: 正式 owner 更名迁移共享资源

Tests:
- `test:1be2551068f1dbd2f5f6f17176cd1d5aa098007c969e0a9a208a3ec7b937b00d`
- `test:bfc8a2107b179a5b9d77513e890c07bc7f9c82ffabb7f10f65a2dc1ad21bb9de`

Tags:
- `investigation-report`

Contract:
- 正式报告 rename 改写所选身份的正式引用并迁移受管资源。

Proves:
- 真实文件 fixture 的 rename 已提交，新 owner 资源字节保持，其他报告链接指向新 owner；同 fixture 中仍被共享的资源不能 discard。
- 另一正式报告引用旧 ID 时，先拒绝 discard；rename 提交后该报告的关系 target 改为新 ID，旧报告路径退出。
