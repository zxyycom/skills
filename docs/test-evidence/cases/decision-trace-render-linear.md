### Case DECISION-TRACE-RENDER-LINEAR-001: 层与事件渲染复用一次关系上下文

Tests:
- `test:1072faef1d26240b40937ff5d6a25fa4ebde8f855ff961971b0e0a86bcbaa773`

Tags:
- `decision-records`

Contract:
- 一次 render 构建反向与事件事实，后续 BFS、successor 和事件输出应复用，不逐节点或事件反查整片。

Proves:
- V=10/100/1000 的 chain、star、多事件均打印全部主体，实际 relation list getter 访问不超过 3V。
