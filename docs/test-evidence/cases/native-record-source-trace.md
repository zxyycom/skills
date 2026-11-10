### Case NATIVE-RECORD-SOURCE-TRACE-001: trace 不合并不同来源的关系图

Tests:
- `test:575c69d597ce735a61f5d476d7b20ba92c8cd4b7d13997308754634b8dcc8b85`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 按 key 的 trace 对每源独立选择关系图并保留原 trace 结果形状，同 ID 不跨源合并。

Proves:
- 两个来源都含 260101-a，仅第二源声明 a 补充 b；真实 trace 均成功，第一源 traceIds 只有 a，第二源为 a、b，anchorId 均保持 a。
