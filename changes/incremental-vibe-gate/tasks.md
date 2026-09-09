# Tasks

任务先固定影响与证据契约，再实施选择和缓存，最后以正确性反例与性能场景共同验收。

## Readiness
- [x] 0.1 核对当前 Gate Check 目录、资源约束、现有缓存、工作区重复扫描与代表性热运行基线。
- [x] 0.2 定义“无关”为有效输入指纹命中最近通过证据，并明确直接、传递、共享、配置、工具链、未知输入和环境状态边界。
- [x] 0.3 审计全部 base Check 的 owner、直接输入、跨 owner 依赖和可复用策略，形成第一版保守 impact contract。

## Implementation
- [x] 1.1 实现 invocation 级文件快照、内容身份、直接标签派生、标签传播与未知输入 global fallback。
- [x] 1.2 实现 Check 有效输入指纹、严格通过证据读取、成功后原子发布和工作区漂移保护。
- [x] 1.3 将 activation plan 接入 Vibe flags/effective aggregation，并在 CLI 输出中区分执行、复用、保守 fallback 与 release 全量。
- [x] 1.4 为 base package、semantic 和适用原生 Checks 声明影响标签与复用策略，并把完整 Git/工具/进程环境身份纳入所有复用证明。
- [x] 1.5 为 test-evidence snapshot fact 增加严格内容寻址缓存，并减少重复来源指纹、闭包、AST 和注册工作。
- [x] 1.6 同步项目工具链说明与长期 Gate 决策，移除被新契约修订的旧性能边界。
- [x] 1.7 为新增或修改的每个最小测试入口维护 Case 并同步测试证据索引。

## Verification
- [x] 2.1 验证首次运行、相同内容复用、单 owner 改动、共享依赖传播、新增未知文件、配置/工具链变化和内容回退。
- [x] 2.2 验证失败 Check 不产生证据、缓存损坏按 miss 重算、运行中漂移不发布以及 release 始终执行完整集合。
- [x] 2.3 运行目标测试、typecheck、lint、format、Test Evidence 目录/项目检查和完整 `bun run check`。
- [x] 2.4 分别测量热运行、普通单 owner 增量和较重增量的 p50/p95；确认目标或记录仍需优化的实际瓶颈。

## Performance Evidence

以下样本均通过权威 `bun run check` 入口、在同一增量行为版本和本机环境中交替形成，文件在每次场景后恢复原字节并以最后一次运行恢复原状态 receipt；p95 取六个样本中的最大值，不以插值弱化小样本边界。后续代码审核收紧了工具链、错误诊断与输入边界，但没有改变这三个场景的 activation 集合；审核后的提交版本另以全量和提交后普通运行复核固定成本。

| 场景 | 实际 activation | 样本（秒） | p50 | p95 |
| --- | --- | --- | --- | --- |
| 稳定复用 | execute 0 / reuse 35 | 1.647, 1.530, 1.494, 1.416, 1.340, 1.352 | 1.455s | 1.647s |
| 普通 Markdown owner 往返 | execute 2 / reuse 33 | 3.587, 3.396, 3.689, 3.402, 3.462, 3.514 | 3.488s | 3.689s |
| shared-tools 重增量往返 | execute 28 / reuse 7 | 12.221, 12.059, 11.639, 11.681, 11.947, 11.675 | 11.814s | 12.221s |

首次或 `global` 输入变化仍保守执行全部 35 个 base Check；主要实现完成时两次完整验证墙钟为 16.376s 和 18.755s，对应 Vibe execution 15.1s 和 17.3s；输入边界审核后再次全量验证的 Vibe execution 为 19.7s。它不满足 15 秒上限，是第一版保守 fallback 的已知剩余边界；普通和 shared-tools 增量目标已满足。容量对照中，shared-tools 的 Vibe execution 从 external capacity 2 的 17.4s 降到 capacity 3 的 14.6s；capacity 4 出现 15.5s 和一次 function-metrics unavailable，因此最终保持 3。
