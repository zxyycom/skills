### Case TASK-GRAPH-RUNTIME-GATE-001: CLI 在参数和 apply 输入访问前统一 gate mutation

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI gates every mutation before argument parsing or apply request and index access`
- `bun test --test-name-pattern="^CLI gates every mutation before argument parsing or apply request and index access$" ./tools/task-graph/tests/run.ts`

Contract:
- 识别 mutation 后必须先加载 runtime；缺失时 `RUNTIME_MISSING` 优先于 malformed args 或不可读 request。

Proves:
- 23 个 mutation command path 全部先返回 revision null 的 runtime error；其中 malformed scope create 与 apply file 进一步证明参数、请求文件和索引读取计数为零，工作区目录未创建。
