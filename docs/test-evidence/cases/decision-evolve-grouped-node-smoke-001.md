### Case DECISION-EVOLVE-GROUPED-NODE-SMOKE-001: 分发 CLI 同进程解析分组 Evolve 参数

Tests:
- `test:ed35edc36c8de4a6c41105624779a826b79017ca95edd4c3ea3ca922c9bca1f8`

Tags:
- `decision-records`

Contract:
- 分发 CLI 入口解析逐 successor 分组并执行只读 preflight。

Proves:
- 对真实闭合拆分集合运行分发同进程 CLI，返回成功 preflight review 与空 stderr；该入口不启动 Node 子进程。
