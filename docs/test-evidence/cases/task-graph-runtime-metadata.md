### Case TASK-GRAPH-RUNTIME-METADATA-001: 生成入口给出可维护来源而不泄漏本地路径

Tests:
- `test:64664651d9a8a8c454f3406a5d8c88050b0e4df817a4ddc3085b26256f07b547`

Tags:
- `task-graph`

Contract:
- 分发元数据标识维护源码与重建入口，不带工作区路径或调试制品。

Proves:
- 入口标记源码 URL、sync 命令与 runtime 路径，复制 renderer 有同步头；没有 debugId、本地绝对路径或相邻 .mjs.map。
