### Case GATE-DECLARATION-CODE-UNION-001: 声明领域不扩大联合选择的维护代码指标

Tests:
- `test:ab8609914ccb13e6db201d1763484e4affcd2a8f262840c3aad15ea6f6876f99`

Tags:
- `repository-tooling`

Contract:
- selected 联合选择代码领域与声明领域时，两项指标只投影代码领域的维护源码，声明 API 与技能生成副本不扩大指标范围。

Proves:
- 真实文件树同时放置 task-graph 源码、两个声明域的 API 文件及技能生成副本；从联合 Definition 提取两项指标的文件声明后，collectProjectFiles 均只返回独立列出的 task-graph 路径。
- 同时传入三个领域 flag 执行真实 function-metrics，所选健康代码 passed、aggregate passed 且没有 finding；声明及生成文件中的六参数函数不污染结果。
