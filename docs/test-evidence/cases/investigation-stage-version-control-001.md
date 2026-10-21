### Case INVESTIGATION-STAGE-VERSION-CONTROL-001: stage --scope index reports unavailable version control without working-tree writes

Tests:
- `test:bb9c5998e4f22f451d05ce2d44e385f9cf72ad7d1edd80137b2b959d2194fe22`

Tags:
- `investigation-report`

Contract:
- 选择性暂存要求可用版本仓库，失败时不改写工作树。

Proves:
- 非 Git fixture 的真实 CLI stage 返回退出码 1 与 repository-unavailable 诊断；报告 Markdown 和派生 index 的完整字节保持不变。
