### Case TASK-GRAPH-LOCK-PATH-001: 锁路径由系统临时目录中的索引 hash 确定

Tests:
- `test:1c689495820baf623e5230e8e9992bda83ca6f826e96ffddaf5a06f4f9a5a0bf`

Tags:
- `task-graph`

Contract:
- 同一规范索引路径必须映射到同一系统临时锁，不同索引映射到不同锁；index init 不修改调用方 `.gitignore` 或创建工作区相邻锁。

Proves:
- 默认 lock 位于 `os.tmpdir()/task-graph-locks` 且文件名是 64 位 SHA-256；init 保留 CRLF ignore 原文，索引旁没有 `.lock`。
