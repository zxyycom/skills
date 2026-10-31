### Case GATE-SELECTED-PROVIDER-RERUN-001: 窄生成失败提示保留实际重跑参数

Tests:
- `test:4131161c4bb67977f0aa4cc77bab5bb8f6e246ebcc76c15bf450359b10240048`

Tags:
- `repository-tooling`

Contract:
- Check 失败的直接重跑提示投影当次 Definition 声明的实际命令；selected 生成前置的 --skill 参数不能退化为全量命令。

Proves:
- mcpshell selected 的真实 Definition provider 声明 bun run check:skill-updaters --skill mcpshell-workspace-tools；仅替换执行器制造 provider 失败，仍保留原始命令 options。
- 原生调度确实执行 provider 并阻止 public-distribution 依赖，CLI 退出 1；stderr 给出带完整 --skill 参数的精确重跑命令边界及 Check process.log 定位，不重建成全量 updater 命令。
