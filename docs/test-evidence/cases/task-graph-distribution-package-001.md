### Case TASK-GRAPH-DISTRIBUTION-PACKAGE-001: skill 树不携带 runtime 或安装产物

Tests:
- `test:275e8b42f6151a762a0ec9f64af64d4b1d0b7c42f604467e5a6b874ddae8c2af`

Tags:
- `task-graph`

Contract:
- Skill 分发只提供 runtime 探测与安装 argv，不包含 runtime manifest、npm lockfile、`.node`、npm cache 或 `.install-*`。

Proves:
- 递归检查 task-graph skill 树确认 runtime 资产目录、native 二进制与安装期路径全部缺失。
