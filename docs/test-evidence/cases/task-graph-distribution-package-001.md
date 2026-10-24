### Case TASK-GRAPH-DISTRIBUTION-PACKAGE-001: skill 树不携带原生运行时或安装产物

Tests:
- `test:275e8b42f6151a762a0ec9f64af64d4b1d0b7c42f604467e5a6b874ddae8c2af`

Tags:
- `task-graph`

Contract:
- Skill 分发保留 TS 工具本体；原生运行时及其安装产物留在独立安装边界。

Proves:
- 递归同时检查文件与目录身份，确认无 references/runtime 目录、.node 二进制、node_modules、npm-cache 或 .install-*；空安装目录也不能逃过检查。
