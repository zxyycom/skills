### Case GATE-PERFORMANCE-INVALID-001: 非法测量以有界 JSON 安全报告阻断

Tests:
- `test:0093e150c8742c03676aff5ff04996ce4396ef1f1e4121a5fd10bca71eaa37fa`

Tags:
- `performance`
- `repository-tooling`

Contract:
- 负数或非有限耗时不能冒充有效测量；公开报告不暴露原始 Check ID，诊断数量有界，合法有限大数不得因均值求和溢出失真。

Proves:
- 墙钟及 Check 的负数、NaN 与正负 Infinity 均标记 invalid 并失败；非法 Check 样本不生成看似完整的均值或 P90。
- 一百个带控制字符 ID 的坏样本只产生两项固定原因，序列化报告少于五百字符且不含该 ID；两个 MAX_VALUE 样本的均值和 P90 保持有限并产生两项超限。
