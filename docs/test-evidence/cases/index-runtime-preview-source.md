### Case INDEX-RUNTIME-PREVIEW-SOURCE-001: 同步预演拒绝来源无效或期间漂移

Tests:
- `test:29df4dda46d8e6be44f3cf3e9c59f1dc744837987cde34a6fc6baa39ae18f50f`

Tags:
- `index-runtime`

Contract:
- 全量与 selected 预演完整验证候选来源并独立复核 revision，不能接纳无效来源或期间漂移。

Proves:
- 两种 scope 的来源解析失败均阻断；独立 revision 不同产生 source-changed 诊断，持久 baseline 字节不变。
