### Case INVESTIGATION-STAGE-LOCAL-ACQUISITION-001: 索引暂存不依赖报告正文

Tests:
- `test:377f869a34af709f3f1366295acf1d3e0190cb773fe725973ce69f242045e849`

Tags:
- `investigation-report`

Contract:
- Investigation index scope 暂存使用发布索引投影，不要求当前报告正文。

Proves:
- 真实 Git fixture 只有索引而没有报告正文时，IR stage_index 成功刷新所选索引投影并保留未选 pending 投影。
