### Case GATE-CLI-RESULT-001: CLI 解析调用、发布项目摘要并映射原生 Run 结果

Tests:
- `test:06a8374656f0556a7dfda7596740831eeef3a6f3110ff1f31aeb4c7ea2fad4ec`
- `test:1d3becf581a8c91321e4c662169b81616f4ed80f0487ae21eb9550c141623d62`
- `test:45bc6a3f293e8463bb4bcbd60002e2d7d5d96d9cdde8091629780ff9c5f05d57`
- `test:4678ee28d262baca0809ed37f2304ed69fdb420ea07dd65bed3a58522eeb172d`
- `test:85e5386ec7fc2a1e640cf937d9e8fb22e4e549998ac2ee499a3aceed8665c9ef`
- `test:90990e1b669d7914b2dc99eb09ed13a66e00798b1cd16d7517ff4246c2e4e82e`
- `test:a4f1cb0ee6c3e46cd4098c505c2c24afae82a67b553fed39be58265a50ac9cc8`
- `test:badffcc66a77d910a724b985ffe56b0ca4ef8ce298a5f855ba29076881fc8461`
- `test:c08664f22595a1ad5e60a530bec7cf13d00bd2609a7b42aa400dcf1e73a30929`
- `test:f420567eba55df6585fa25e238bf67a43b2d8d3ec49aaebf5c017a30caf720b1`

Tags:
- `repository-tooling`

Contract:
- CLI 默认 quick，legacy 显式 scope 接受 quick、changed 与 full，能力组选择由 selected 契约承接；release tag 与 --full 兼容别名保持独立，release 缺省基线 HEAD。一次 baseline-ref、仅 release 的 cold 与 diagnostic-log 按参数契约解析。调用使用唯一 artifact 根和原生输出配置；changed 只有最终 Run 成功才允许发布项目成功 receipt，失败重跑命令来自当次 Definition 的实际命令声明，失败诊断不得泄露子命令输出或私有异常文本。

Proves:
- UTC timestamp 与 UUID 形成调用目录；scope、tag、别名、基线、cold 与诊断参数按期望解析，重复、冲突、错位、未知或无效参数在创建 Definition 前被拒绝；check:changed 的命令委派为 bun run check --scope changed，all 委派为 bun run check:changed。
- 成功调用将公开 flags、projectRoot 与对应 machine/progress/Check 输出路径交给 Vibe；diagnostic flag 开启固定 core/scheduler channel，已完成失败仍回显 artifact 与诊断路径，无 outputs 的配置失败不回显目录。
- changed 增量摘要保存 activeToolIds、所选工具 flags、逐 Check 决策、execute/reuse/fallback 计数与 receipt 发布结果；fallback 保留可定位原因，并在终端提供执行与复用摘要。
- aggregate failed、输出终态失败与 Run rejection 返回退出码 1，不发布成功；允许调用发布器的失败结果明确携带 runSucceeded=false，rejection 不调用发布器，私有失败细节不进入诊断。
- 真实项目 typecheck 退出失败时 CLI 给出 bun run typecheck 直接重跑提示和 process.log 定位，不转发 private-child-marker。
