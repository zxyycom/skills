### Case INVESTIGATION-STAGE-UNSELECTED-REPRESENTATIONS-001: 保留未选可执行资源与链接快照

Tests:
- `test:6680ae5d0e74ecd879c1cee82b5617a1040e302110d7a2b03fe178c1d0f6a237`
- `test:c94df6ee92ec62fab0e4e60f3ae689bd8c315863f7177cd619242cca8e0d7d77`

Tags:
- `investigation-report`
- `version-control`

Contract:
- all/domain 重建整个调查 pending 范围时，未选报告的合法文件表示不是冲突，且字节与表示保持原样。

Proves:
- 两个未选可执行附件及一个既有 pending 符号链接不阻断另一报告暂存，三个条目的原模式与对象 ID 原样保留并列入 preservedPendingPaths。
