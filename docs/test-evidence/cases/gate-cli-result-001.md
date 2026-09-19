### Case GATE-CLI-RESULT-001: CLI 解析 release tag、兼容别名与基线并映射 Vibe 结果

Tests:
- `test:692e18c3cb0307128e88e42430d5eac13aae95eafca871810ef3b231fb838382`
- `test:703a12af75cd4989a6203167c88f473627a0d40ae8e3d87289f2d037042d3f2d`
- `test:8e54940ce9df266fbc22bd0b9aac593fa25418d3d3f92a9fafd83288dc67fe19`
- `test:a89a47f357d4b1dde3552e06f3ddb365bde30407c74325a3b026ddf600eca478`
- `test:aefa1c3369604e1b2d40f838d9ff0bdaf2aa61f3c1bda6ff2a6a00f8fd6a51ca`
- `test:c4f1771cab3ff91b9948c5afd340adf52a93dde3ad31a0bcfb0310eebb79d4d1`
- `test:cc6761260cd69c0dc3f5ae516f383c99056990d9169a6cb9759e0b063c08452c`
- `test:da5c8a51fd7703c420f54792f6db2a33384964393dbdee42675164681745351b`

Tags:
- `repository-tooling`

Contract:
- 权威入口接受无 tag 的增量 base Gate，或一次 `--tag release` 的全量 release Gate；`--full` 只作为 release tag 的兼容别名。release 缺省基线为 `HEAD`，可追加一次 `--baseline-ref <ref>`、只限 release 的 `--cold` 与一次 `--diagnostic-log`；显式 cold 或 CI 环境都必须禁止复用 release test batch proof。参数错误必须在启动 Check 前失败。每次有效调用使用唯一 invocation directory、effective aggregate、machine/progress/Check artifact 路径，增量计划通过内部 flags 交给 Vibe 并单独发布执行、复用与 receipt 事实，diagnostic flag 只开启该目录的固定 channel 日志。已完成但 aggregate failed 的结果与非 completed Vibe Result 都映射为稳定的非零退出和可行动诊断。

Proves:
- base/release 使用同一完整 63 项 Definition；基础环境 Check 每次进入 aggregate，base 另根据输入证明选择最多 59 个 impact Check，release 选择全部 63 个 Check；release 的显式基线原样传入 Definition，`--cold` 只在 release 中合法并传入测试批次 proof options，tag、兼容别名、重复参数与基线错误在启动前给出 usage。
- 调用控制使用 `checks: "effective"`，把规范化公开 flags、内部 activation flags 与唯一目录下的 `machine/`、`progress.log`、`checks/` 一起交给 Vibe；目录名由 UTC timestamp 与 UUID 构成，`gate-incremental.json` 保留 activation 计数、逐 Check 决策、snapshot fallback detail、receipt 发布结果和 release 测试证明状态；本地可复用、显式 cold 与 CI 隐式 cold 都由与宿主环境无关的 fixture 分别证明，reused 与 cold 分别写入机器字段并产生可核对的终端提示。
- effective aggregate 始终对空选择 fail closed；当前完整 Definition 即使复用全部 59 个 impact Check，也仍由每次执行的基础环境 Check 提供真实 outcome。
- completed 或带 outputs 的失败回显 invocation artifact 根；启用 diagnostic flag 时另回显 `diagnostics/core.log` 与 `scheduler.log`。failed aggregate 与 configuration 类 invocation failure 都返回退出码 1、保留 Vibe 状态或类别而不重建 renderer；configuration 因没有 outputs 不回显目录。
