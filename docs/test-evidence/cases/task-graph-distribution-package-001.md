### Case TASK-GRAPH-DISTRIBUTION-PACKAGE-001: skill 树不携带原生运行时或安装产物

Tests:
- `test:20cf60fc6f42a218007559eddee013091ed2a62cdd777b71c792efc493196482`

Tags:
- `task-graph`

Contract:
- Skill 分发保留 TS 工具本体；原生运行时及其安装产物留在独立安装边界。

Proves:
- 递归同时检查文件与目录身份，确认无 references/runtime 目录、.node 二进制、node_modules、npm-cache 或 .install-*；空安装目录也不能逃过检查。
