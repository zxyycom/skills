### Case RELATION-TRACE-SELECTION-001: 共享 Trace 选择保持事件与覆盖边界

Tests:
- `test:145e6b451b76a9617d0c504d0d687bebc561149a1a36196e68897acf6e58eb24`
- `test:1d575c37b72de359f4e628f8d1923ea76ad03b9837b1ea607ee6b013286fb148`
- `test:7c68be8e309022b48ec45c3778a7a385d28374d2dd7591af6be2c58af8189fc0`
- `test:7d0ad7ff1b1c3deda739a80d341886bcadfa3fea141208a8442e3b8ab63d90c1`
- `test:d9e5fe40b5983248ea546d2ac49f4dd354024d2d59d725e0ad6517cbf29c07ec`

Tags:
- `relation-graph`

Contract:
- 共享 Trace 选择按 UTF-16 稳定 BFS 接纳唯一记录；context 只为完整事件闭合，depth 和记录预算以可续查 frontier 及可选 blockedEvent 表达。

Proves:
- 普通记录预算按 BFS 与 UTF-16 顺序停止；双向扩展仍先处理成员的 predecessors、再处理 successors，但下一深度层的成员按 UTF-16 排序，并返回遗漏的直接续查边界；frontier 字段顺序为 fromId、direction、reason、nextIds。
- 事件上下文在随后被直接到达时提升为 trace member。
- depth 与记录预算可以同时形成各自 frontier，depth 0 仍返回 anchor。
- 放不下完整事件时不部分接纳，并给出完整成员与最小 requiredMaxRecords。
