### Case DECISION-GENERATED-ARTIFACTS-001: 生成决策声明提供可移植 CLI API

Entry:
- `tools/decision-records/tests/generated-artifacts.test.ts > generated decision declarations expose a portable CLI API`
- `bun test --test-name-pattern="^generated\ decision\ declarations\ expose\ a\ portable\ CLI\ API$" ./tools/decision-records/tests/run.ts`

Contract:
- 分发声明必须从 CLI 运行时导出机械生成，保留既有决策类型并携带可由隔离 TypeScript 消费者解析的最小可达闭包。

Proves:
- 根声明与五个可达声明文件保持同步；其中 CLI I/O 声明与 CLI API 一同分发，且整个声明树不引用 TypeScript 源文件或 index-runtime。
- 隔离消费者可以导入运行时函数和既有公开决策类型，并通过严格 TypeScript 编译。
