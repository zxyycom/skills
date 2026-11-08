### Case INVESTIGATION-DISCARD-REFERENCES-001: discard 保护共享资源 owner

Tests:
- `test:1be2551068f1dbd2f5f6f17176cd1d5aa098007c969e0a9a208a3ec7b937b00d`
- `test:bfc8a2107b179a5b9d77513e890c07bc7f9c82ffabb7f10f65a2dc1ad21bb9de`

Tags:
- `investigation-report`

Contract:
- 共享资源或正式关系仍被其他报告引用时，不能删除所选目标。

Proves:
- 正式报告共享 owner 文件时 discard 不提交，资源文件仍存在。
- 存在正式关系引用时 discard 不提交、诊断指向引用者，目标报告仍在。
