### Case INVESTIGATION-STAGE-UNSELECTED-REPRESENTATIONS-001: 保留未选可执行资源与链接快照

Tests:
- `test:ea2aaa6a9b11c5686dfb5ed0a84ac8c196d8788d380df06fbf7c423d6cb3902d`

Tags:
- `investigation-report`
- `version-control`

Contract:
- all scope 重建整个调查 pending 范围时，未选报告的合法文件表示不是冲突，且字节与表示保持原样。

Proves:
- 两个未选可执行附件及一个既有 pending 符号链接不阻断另一报告暂存，三个条目的原模式与对象 ID 原样保留并列入 preservedPendingPaths。
