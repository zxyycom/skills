### Case AGENT-MEMORY-DISTRIBUTION-001: 随包 Node CLI 可独立运行

Tests:
- `test:e294528ff55cf185cd43d87039935d59975962711b81f9a23056fa87117a8249`

Tags:
- `agent-memory`

Contract:
- 随包 CLI 在受支持的 Node 中可使用真实命令参数访问绑定的本地 SQLite 库。

Proves:
- 在源码树外只使用包内 CLI、运行时和宿主已备的 Valibot；独立 Node 进程从 stdin 读取输入，初始化隔离库、保存并按中文原文召回，成功的 JSON 只写 stdout。
- 缺库查询和缺少 schema 资源的初始化均非零退出并只向 stderr 输出各自诊断；失败初始化未留下新库。
