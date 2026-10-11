### Case DECISION-TRACE-RENDER-LINEAR-001: 层与事件渲染复用一次关系上下文

Tests:
- `test:e5c62914fb5550628fa1beaffeabb81c27f8123c5ec923c5d7596c274f8125b1`

Tags:
- `decision-records`

Contract:
- 一次 render 构建反向与事件事实，后续 BFS、successor 和事件输出应复用，不逐节点或事件反查整片。

Proves:
- V=10/100/1000 的 chain、star、多事件均打印全部主体，实际 relation list getter 访问不超过 3V。
