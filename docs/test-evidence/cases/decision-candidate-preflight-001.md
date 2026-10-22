### Case DECISION-CANDIDATE-PREFLIGHT-001: Lifecycle preflight 只读且要求 body-ready candidate

Tests:
- `test:3b273143a845d2c3010fd07e0d07d547dce7459be95b9e1e8bd1d2bfc8d3d409`

Tags:
- `decision-records`

Contract:
- 显式生命周期预检保留正文 ready 与只读保证；new 的可选 alignment 仅为未写入的提示，不构造发布投影。

Proves:
- 未完成候选的显式 publish 预检失败、ready 后预检通过且正文和索引不变，正式发布才写入 alignment；new 不默认进行辅助发布准备。
