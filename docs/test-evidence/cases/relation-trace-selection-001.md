### Case RELATION-TRACE-SELECTION-001: 共享 Trace 选择保持事件与覆盖边界

Tests:
- `test:0de0a95069e833e561b2fdb49a58d59db69071adc8318ead4fff8d465815f0bf`
- `test:1e0f84049669d91841e43a10bd4e28df700ce7adcb34765038f1392587ec8098`
- `test:6f0d8b7d7de13f1011d41927c77eacf2f7db39afd70d3e83ecdbd46ed0cec739`
- `test:a82f0373aa25fa636b62ee33e369c12056a05ad3990863b5fb149d97d09a5339`
- `test:c7bf56b20f9c7ae0d578bf9494dc731605843ae03d26f5371348de04c30aa917`

Tags:
- `relation-graph`

Contract:
- 共享 Trace 选择按 UTF-16 稳定 BFS 接纳唯一记录；context 只为完整事件闭合，depth 和记录预算以可续查 frontier 及可选 blockedEvent 表达。

Proves:
- 普通记录预算按 BFS 与 UTF-16 顺序停止；双向扩展仍先处理成员的 predecessors、再处理 successors，但下一深度层的成员按 UTF-16 排序，并返回遗漏的直接续查边界；frontier 字段顺序为 fromId、direction、reason、nextIds。
- 事件上下文在随后被直接到达时提升为 trace member。
- depth 与记录预算可以同时形成各自 frontier，depth 0 仍返回 anchor。
- 放不下完整事件时不部分接纳，并给出完整成员与最小 requiredMaxRecords。
