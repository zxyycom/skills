### Case TASK-GRAPH-DISTRIBUTION-001: 分发运行 API 与版本符合源码

Tests:
- `test:0bebe9087059f724355b3fe04631234d6359417d752862f47d8efad46b444aa6`

Tags:
- `task-graph`

Contract:
- 分发入口提供当前公开运行 API，且与源码 CLI 版本行为一致。

Proves:
- 生成入口和源码 export 集合一致，Service/runner 严格指向包内运行实现，--version 的退出结果与输出一致。
