### Case GATE-CLI-RESULT-001: CLI 解析 profile、基线与诊断日志并映射 Vibe 结果

Entry:
- `scripts/vibe-check.test.ts > CLI parses profiles and full baselines, then maps Vibe results to exit codes`
- `bun test --test-name-pattern="^CLI parses profiles and full baselines, then maps Vibe results to exit codes$" ./scripts/vibe-check.test.ts`

Contract:
- 权威入口接受无参数或一次 `--diagnostic-log` 的 default，及带可选一次 `--baseline-ref <ref>` 和一次 `--diagnostic-log` 的 `--full`；full 缺省基线为 `HEAD`。显式基线必须非空、没有首尾空白、不以 `-` 开头且不含 NUL、CR 或 LF。未知、重复或未与 `--full` 组合的参数必须在启动 Check 前失败；diagnostic flag 只覆盖当前 invocation 的 diagnostic 输出，不改变 machine publication。已完成但 aggregate failed 的结果与非 completed Vibe Result 都必须映射为稳定的非零退出和可行动诊断；带非空 diagnostic file 的任一结果都要回显该路径，configuration 因没有 outputs 不回显。

Proves:
- default/full 选择各自 Definition，full 的显式基线原样传入 Definition；`--diagnostic-log` 可单独用于 default，或与 full/基线组合。首尾空白、前导连字符及 NUL/CR/LF 输入、未知参数、重复 diagnostic flag，以及没有 full 的 baseline 都在启动前给出 usage。
- 每次 CLI invocation 向 Vibe 传入一个 Run AbortSignal；启用 diagnostic flag 时，调用控制只为当前 invocation 启用 `.log/vibe-check` 的 diagnostic logging。completed passed/failed aggregate，以及 cancelled、planning、execution、output 的 invocation failure 在返回非空 diagnostic file 时都回显实际 `run-*.log` 路径。failed aggregate 与 configuration 类 invocation failure 都返回退出码 1、保留 Vibe 状态或类别而不重建 renderer；configuration 因没有 outputs 不回显日志路径。
- 模拟 CLI 结果时注入测试内 scheduling hints store；三个 completed passed invocation 只记录三次内存写入，不创建或改写仓库根目录的性能提示文件。
