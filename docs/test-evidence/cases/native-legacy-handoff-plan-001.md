### Case NATIVE-LEGACY-HANDOFF-001: 旧版交接计划保留定制与依赖

Tests:
- `test:f88665660489ea5ba2fb07bae2787e0591ca3ca1f28ce0d3d756ac95d0246fcb`

Tags:
- `repository-tooling`

Contract:
- 交接计划仅能退役经清单验证的旧受管文件，不能覆盖未知定制或修改既有依赖。

Proves:
- 经验证文件可列入替换或退役，未占用目标可列入新增。
- 用户文件冲突、依赖目录、路径别名及受管文件内容变化阻断计划，未改变目标内容。
