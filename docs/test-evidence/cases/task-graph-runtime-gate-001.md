### Case TASK-GRAPH-RUNTIME-GATE-001: CLI 在参数和 apply 输入访问前统一 gate mutation

Tests:
- `test:5887813abda91c657e6b98872e62d1ba279a8ff748ab185dcb3f7061d8d843fb`

Tags:
- `task-graph`

Contract:
- 识别 mutation 后必须先加载 runtime；缺失时 `RUNTIME_MISSING` 优先于 malformed args 或不可读 request。

Proves:
- 18 个 mutation command path 全部先返回 revision null 的 runtime error；其中 malformed task create 与 apply file 进一步证明参数、请求文件和索引读取计数为零，工作区目录未创建。
