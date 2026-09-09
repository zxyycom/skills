### Case GATE-CLI-RESULT-001: CLI 解析 release tag、兼容别名与基线并映射 Vibe 结果

Tests:
- `test:1d680d28a3a3d73a5c7a141be0159e8399ba94308a60446078262afccdb0afb3`

Tags:
- `repository-tooling`

Contract:
- 权威入口接受无 tag 的 base Gate，或一次 `--tag release` 的 release Gate；`--full` 只作为 release tag 的兼容别名。release 缺省基线为 `HEAD`，可追加一次 `--baseline-ref <ref>` 与一次 `--diagnostic-log`。参数错误必须在启动 Check 前失败。每次有效调用使用唯一 invocation directory、effective aggregate、machine/progress/Check artifact 路径，diagnostic flag 只开启该目录的固定 channel 日志。已完成但 aggregate failed 的结果与非 completed Vibe Result 都映射为稳定的非零退出和可行动诊断。

Proves:
- base/release 使用同一完整 Definition，分别选择 35 个 base Check 或全部 63 个 Check 进入 aggregate；release 的显式基线原样传入 Definition，tag、兼容别名、重复与基线错误在启动前给出 usage。
- 调用控制使用 `checks: "effective"`，把规范化 flags 与唯一目录下的 `machine/`、`progress.log`、`checks/` 一起交给 Vibe；目录名由 UTC timestamp 与 UUID 构成。
- completed 或带 outputs 的失败回显 invocation artifact 根；启用 diagnostic flag 时另回显 `diagnostics/core.log` 与 `scheduler.log`。failed aggregate 与 configuration 类 invocation failure 都返回退出码 1、保留 Vibe 状态或类别而不重建 renderer；configuration 因没有 outputs 不回显目录。
