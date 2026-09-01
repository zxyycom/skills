### Case GATE-CLI-RESULT-001: CLI 解析 release tag、兼容别名与基线并映射 Vibe 结果

Entry:
- `scripts/vibe-check.test.ts > CLI parses release tags and compatibility alias, then maps Vibe results to exit codes`
- `bun test --test-name-pattern="^CLI parses release tags and compatibility alias, then maps Vibe results to exit codes$" ./scripts/vibe-check.test.ts`

Contract:
- 权威入口接受无 tag 的 base Gate，或一次 `--tag release` 的 release Gate；`--full` 只作为 release tag 的兼容别名。release 缺省基线为 `HEAD`，可追加一次 `--baseline-ref <ref>` 与一次 `--diagnostic-log`。显式基线必须非空、没有首尾空白、不以 `-` 开头且不含 NUL、CR 或 LF。未知 tag、重复 tag、缺失 tag 值、未知参数或未与 release tag 组合的基线必须在启动 Check 前失败；diagnostic flag 只覆盖当前 invocation 的 diagnostic 输出，不改变 machine publication。已完成但 aggregate failed 的结果与非 completed Vibe Result 都必须映射为稳定的非零退出和可行动诊断；带非空 diagnostic file 的任一结果都要回显该路径，configuration 因没有 outputs 不回显。

Proves:
- base/release 使用同一完整 Definition，分别选择 32 个 base Check 或全部 60 个 Check 进入 aggregate；release 的显式基线原样传入 Definition，tag、兼容别名、重复与基线错误在启动前给出 usage。
- 每次 CLI invocation 向 Vibe 传入一个 Run AbortSignal；启用 diagnostic flag 时，调用控制只为当前 invocation 启用 `.log/vibe-check` 的 diagnostic logging。completed passed/failed aggregate，以及 cancelled、planning、execution、output 的 invocation failure 在返回非空 diagnostic file 时都回显实际 `run-*.log` 路径。failed aggregate 与 configuration 类 invocation failure 都返回退出码 1、保留 Vibe 状态或类别而不重建 renderer；configuration 因没有 outputs 不回显日志路径。
- 模拟 CLI 结果时注入测试内 scheduling hints store；三个 completed passed invocation 只记录三次内存写入，不创建或改写仓库根目录的性能提示文件。
