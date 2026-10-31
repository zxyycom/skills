### Case GATE-SELECTED-CODE-OWNERSHIP-001: 领域指标只选择当前维护代码而不吸收证明依赖

Tests:
- `test:ba0c8fae59e1b17daa110e6c77b5c035a7878f01d2312e0ee4e8de465c3129e4`

Tags:
- `repository-tooling`

Contract:
- selected 的 file/function metrics 从所选领域的 files 选择 scripts/tools 下维护的 JavaScript/TypeScript；additionalInputs、技能生成副本和非代码材料不扩大指标范围。

Proves:
- 从真实 task-graph Definition 的两项原生 Check options 提取文件策略，再经 collectProjectFiles 收集真实私有文件树，结果恰为 task-graph 产品及测试 TypeScript。
- 同树中的其他领域、index-runtime 与 skill-updater 依赖、scripts/lib 证明依赖、技能生成副本、文档区代码、Markdown、JSON、MTS 与 node_modules 均不进入集合；预期路径在测试中独立列出。
