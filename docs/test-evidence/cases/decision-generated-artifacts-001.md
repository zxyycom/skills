### Case DECISION-GENERATED-ARTIFACTS-001: 生成决策声明提供可移植 CLI API

Tests:
- `test:dab7ef4ec63d8a0c6fc30604feb987493484c953806e4c2ebbf5c920c73304a0`

Tags:
- `decision-records`

Contract:
- 分发声明由 CLI 运行时导出生成，提供公开决策类型及重命名 API，并携带隔离 TypeScript 消费者需要的可达模块。

Proves:
- 隔离消费者通过公开 TS 入口导入决策类型、查询与重命名 API，严格 TypeScript 编译通过。
- 编译器从公开入口加载的 SDK 模块集合与实际分发集合一致；声明树携带生成头，且没有指向 TypeScript 源文件或 index-runtime 的引用。
