### Case TASK-GRAPH-LIST-TRACKS-001: Track label 至少两位且没有两位上限

Tests:
- `test:7c92e32ed9c7e167c1efdc0d6159a586795eac01ad088913272a2f29f6c6c143`

Tags:
- `task-graph`

Contract:
- Track 从 T01 起至少使用两位编号，数量超过 99 时自然增长；完整文本只以一个 LF 结束。

Proves:
- 100 个孤立 task 产生 T01 到 T100，最后一个定位实际 task-000100，末尾没有额外空行。
