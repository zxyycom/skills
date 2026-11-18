### Case AGENT-MEMORY-DISTRIBUTION-001: 随包 Node CLI 可独立运行

Tests:
- `test:e294528ff55cf185cd43d87039935d59975962711b81f9a23056fa87117a8249`

Tags:
- `agent-memory`

Contract:
- 随包 CLI 在受支持的 Node 中可使用真实命令参数访问绑定的本地 SQLite 库。

Proves:
- 在源码树外复制随包 CLI 及运行时，只复用宿主已备好的 Valibot；独立 Node 进程初始化隔离库、保存并按中文原文召回，成功的 JSON 只写 stdout。
- 缺库查询为非零退出，诊断只写 stderr；不把启动失败当成正常的领域错误。
