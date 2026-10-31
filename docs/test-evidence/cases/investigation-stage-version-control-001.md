### Case INVESTIGATION-STAGE-VERSION-CONTROL-001: stage --scope index reports unavailable version control without working-tree writes

Tests:
- `test:38b11f82c8bcbc4a0cc0d0a6634ff27e7e1a2637286bb989fed105826be70128`

Tags:
- `investigation-report`

Contract:
- 选择性暂存要求可用版本仓库，失败时不改写工作树。

Proves:
- 非 Git fixture 的真实 CLI stage 返回退出码 1 与 investigation-report.stage-repository-unavailable 诊断；报告 Markdown 和派生 index 的完整字节保持不变。
