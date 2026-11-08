### Case INVESTIGATION-HISTORY-INDEX-DIAGNOSTICS-001: 发布历史索引不可用的恢复提示

Tests:
- `test:643add61f9c8010d3ff714dfb9aaa01538f50ab12c5a5ff160ab8c19e03a102d`

Tags:
- `git-integration`
- `investigation-report`

Contract:
- 发布前历史索引不可用时须明确返回可行动的 warning，不能声称已确认历史。

Proves:
- 真实 Git HEAD 存有无效历史索引时，发布历史检查不提供可信 HEAD 结果，并给出历史索引不可用、目标和完整检查恢复指引。
