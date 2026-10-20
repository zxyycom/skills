### Case GATE-CLI-RESULT-001: CLI 解析调用、发布项目摘要并以最终 Run 结果定退出码

Tests:
- `test:692e18c3cb0307128e88e42430d5eac13aae95eafca871810ef3b231fb838382`
- `test:836ffa62f8e15fc080ae90baf86cb3e7986c543f656f2eaaf0efdff479455505`
- `test:8e54940ce9df266fbc22bd0b9aac593fa25418d3d3f92a9fafd83288dc67fe19`
- `test:a89a47f357d4b1dde3552e06f3ddb365bde30407c74325a3b026ddf600eca478`
- `test:aefa1c3369604e1b2d40f838d9ff0bdaf2aa61f3c1bda6ff2a6a00f8fd6a51ca`
- `test:b617a1af4272b77e30bf45dd6579e00be9c9e91a3356a1ac0f8138909ae41c0f`
- `test:c4f1771cab3ff91b9948c5afd340adf52a93dde3ad31a0bcfb0310eebb79d4d1`
- `test:cc6761260cd69c0dc3f5ae516f383c99056990d9169a6cb9759e0b063c08452c`
- `test:da5c8a51fd7703c420f54792f6db2a33384964393dbdee42675164681745351b`

Tags:
- `repository-tooling`

Contract:
- CLI 接受 base 或 release tag（--full 为兼容别名），release 缺省基线 HEAD；一次 baseline-ref、仅 release 的 cold 与 diagnostic-log 按参数契约解析。调用使用唯一 artifact 根和原生输出配置；只有最终 Run 成功才允许发布项目成功 receipt，失败诊断不得泄露子命令或私有异常文本。

Proves:
- UTC timestamp 与 UUID 形成调用目录；tag、别名、基线、cold 与诊断参数按期望解析，重复、错位、未知或无效参数在创建 Definition 前被拒绝。
- 成功调用将公开 flags、projectRoot 与对应 machine/progress/Check 输出路径交给 Vibe；diagnostic flag 开启固定 core/scheduler channel，已完成失败仍回显 artifact 与诊断路径，无 outputs 的配置失败不回显目录。
- 增量摘要保存 activeToolIds、所选工具 flags、逐 Check 决策、execute/reuse/fallback 计数与 receipt 发布结果；fallback 保留可定位原因，并在终端提供执行与复用摘要。
- aggregate failed、输出终态失败与 Run rejection 返回退出码 1，不发布成功；允许调用发布器的失败结果明确携带 runSucceeded=false，rejection 不调用发布器，私有失败细节不进入诊断。
- 真实项目 typecheck 退出失败时 CLI 给出 bun run typecheck 直接重跑提示和 process.log 定位，不转发 private-child-marker。
