### Case TASK-GRAPH-LIST-TRACKS-001: Track label 至少两位且没有两位上限

Tests:
- `test:519a58b3b0a6877fcba6d7183902ac5c5b9d9f752eab34d1ac1739a41c9583e3`

Tags:
- `task-graph`

Contract:
- Track 从 T01 起至少使用两位编号，数量超过 99 时自然增长；完整文本只以一个 LF 结束。

Proves:
- 100 个孤立 task 产生 T01 到 T100，最后一个定位实际 task-000100，末尾没有额外空行。
