# Tasks

任务先把旧任务转换成能力处置结论，再实现更小的 Vibe 门禁；验收比较责任、失败与副作用，不比较旧任务数量和文本输出。

## Readiness

- [x] 0.1 在 Change 目录建立 `migration-matrix.md`，盘点现有 31 个项目任务并为每项记录能力、owner、失败风险/消费者、retain/replace/merge/retire 处置、最终 check/选择和验证证据；任何空白处置阻止切换。
- [x] 0.2 从处置表形成 default 与 full 能力集合，固定 blocking、required advisory、release-required 和 full-only `pack:skills` 边界；文件/函数指标属于两种选择共同且 finding 永远非阻断的 required advisory check，default 不实例化或检查打包，不沿用旧任务数量作为验收标准。
- [x] 0.3 盘点 `scripts/check.test.ts` 及 Test Evidence，区分需要迁移的公开责任与可以随旧计划、renderer、参数或任务计数一起退役的实现断言。
- [x] 0.4 验证 Vibe config/run、Definition 构造、scheduler、direct dependency、aggregate、RunResult、指标 warning 与 unavailable 结算和 output 开关足以承接目标，只为实际使用的 0.0.1 API 建立契约测试。
- [x] 0.5 固定 default/full、项目脚本失败、Vibe blocking finding、指标永久非阻断 finding、SCC/Lizard unavailable、意外 N/A、invocation failure 和打包失败的能力级对照夹具；切换只要求全部原有必要能力已有接管证据，不增加运行次数、自然日或并行 CI job 门槛。
- [x] 0.6 按 AI-Ready Docs 审阅能力处置表、选择边界、retire 理由、失败诊断和操作者恢复动作，确保“不要求一致”不会被解释为允许无证据删减。

## Implementation

- [ ] 1.1 将 `scripts/vibe-check.ts` 收敛为薄 CLI 与 Vibe 配置，保留 default 和 `--full` 两种用途，删除没有当前消费者证据的 `--verbose`、`CHECK_CONCURRENCY` 和旧摘要兼容层。
- [ ] 1.2 接入重复、JSON、Task Graph/Test Evidence Schema 和 Markdown 链接 Vibe 原生 check，并用代表性 fixture 证明 finding/unavailable 能进入 blocking aggregate。
- [ ] 1.3 接入文件/函数指标 Vibe check 作为 default/full 共用的 required advisory check；finding 永远只产生 warning 并 passed，unavailable/not-applicable 使 aggregate failed；按审计结论保持 `fileMetrics.findingWaivers: []` 且不建立其他 waiver。
- [ ] 1.4 将 SCC 3.7.0 与 Lizard 1.23.0 纳入 `scripts/environment.js` 的本地全局 prerequisite 精确探测，更新环境测试与恢复诊断；现有安装直接复用，门禁和 setup 不联网安装。让原 CI package job 固定安装并探测相同版本后再运行 full。
- [ ] 1.5 实现最小可注入 package-script adapter，使用参数数组启动 Bun，分类非零退出与 unavailable，保留受控诊断，并把聚合、调度和展示交给 Vibe。
- [ ] 1.6 按能力处置表为 30 项 retained 脚本能力和替换后的 `test:check` 建立 `script:<package-script>` check；default/full 恰好使用表中选择，每个 release-required check 都进入 full aggregate，不在实施中另行合并或退役。
- [ ] 1.7 使用 Vibe 原生 scheduler，显式设置静态 `maxParallel: 4`；现有项目 checks 不声明 mutex，`pack:skills` 只由直接依赖排序；不重建旧动态并发环境变量或第二套任务状态机。
- [ ] 1.8 实现 full-only `pack:skills` check，依赖全部 release-required check；default 不实例化或检查打包，full 只有全部 passed 才调用一次，其他 terminal 状态都不产生本次打包写入。
- [ ] 1.9 使用 Vibe progress 和结构化 RunResult 完成状态、原因、恢复动作及最终退出；CLI 只为非 completed RunResult 输出稳定 kind/reason，不增加 check renderer，并保持 machine artifact 与 diagnostic log 关闭。
- [ ] 1.10 将仍有效的选择、aggregate、失败、继续执行、指标、诊断和打包测试迁移到新模块/fixture；删除只锁定旧任务计数、顺序、renderer 或 helper API 的断言。
- [ ] 1.11 在旧入口仍有效时运行候选 `bun run vibe-check` 的 default/full 与 `migration-matrix.md` 故障对照，修复必要能力缺失、错误成功或打包越界；全部原有必要能力有接管证据后即可执行切换，不追加 soak 时长或次数要求。
- [ ] 1.12 对照通过后让 `package.json#check` 指向 Vibe 入口，保留现有 CI job 的 `bun run check --full`，并移除候选 `package.json#vibe-check`。
- [ ] 1.13 删除旧 `scripts/check.ts`、`scripts/lib/check-plan.ts` 及只验证旧实现的代码，更新 `scripts/validators/project-config.ts` 使其要求唯一权威入口。
- [ ] 1.14 更新 `docs/tooling.md` 与相关仓库说明，记录能力组、default/full、blocking/required advisory、SCC/Lizard、Vibe 原生输出和 full-only 打包，不保留旧任务清单作为规范。
- [ ] 1.15 建立 `use-vibe-check-as-authoritative-project-gate` 项目级 Decision Record，归并并归档 `select-prerequisite-checks-by-profile`、`settle-all-selected-checks-under-bounded-concurrency`、`render-check-step-results-concisely`、`derive-check-exit-status-from-step-results` 与 `run-packaging-after-prerequisite-checks`；记录保留的 default/full 与失败后继续语义，以及静态并发 4、Vibe progress/aggregate、full-only 打包和不新增并行 CI job，随后同步决策索引。
- [ ] 1.16 逐项迁移、合并或删除受影响 Test Evidence case，同步 topic 与统一派生索引；retire 的 case 必须能追溯到能力处置表理由。

## Verification

- [ ] 2.1 审计能力处置表，证明旧 31 个任务全部有 retain/replace/merge/retire 结论，且每个 release-required check 都可追溯到最终 check 和最小原生测试证据。
- [ ] 2.2 验证 default 只声明日常覆盖、full 选择全部 release-required check，且两者都运行文件/函数指标；不断言旧任务数量、ID、顺序、逐项 skip 或摘要文本。
- [ ] 2.3 注入领域、代码、Vibe blocking check 及 adapter 的 failed/unavailable，证明 aggregate 和进程退出非零，其他独立 check 仍能收敛且诊断可定位下一步。
- [ ] 2.4 用调用计数与隔离输出目录验证 default 不实例化、不运行且不检查打包，full 全部 required check passed 时只打包一次，任一前置非 passed 时零调用、零本次制品写入，打包失败决定整体失败。
- [ ] 2.5 验证六类 Vibe check 的代表性 pass/finding/unavailable：任何文件/函数指标 finding 都不改变 aggregate、退出或打包资格，SCC/Lizard 缺失或版本不兼容使 aggregate failed 并跳过 full 打包。
- [ ] 2.6 在当前环境验证 SCC 3.7.0 与 Lizard 1.23.0 的已安装来源和直接复用；注入 missing、mismatch 和 probe failure 验证环境恢复诊断，再在带固定 CI setup 的干净目标中探测相同版本并成功运行文件/函数指标。
- [ ] 2.7 验证 Vibe 原生 progress/结果足以表达 check、状态、原因和恢复动作，结构化测试不依赖整段自然语言；machine artifact 未意外落盘。
- [ ] 2.8 完成旧/新能力级对照，证明全部原有必要能力已由新门禁接管、代表性失败仍阻断、full 打包边界不放宽，并显式接受任务与输出形状差异；不以经过天数、运行次数或 revision 数量替代能力证据。
- [ ] 2.9 从干净安装运行现有 CI 等价路径和 `bun run check --full`，确认同一 job、唯一 aggregate、可用指标工具与经 full 证明的 skill 包，不存在并行 job 或第二完成信号。
- [ ] 2.10 运行新门禁定向测试、环境测试、项目配置、Test Evidence、Decision Records、生成/索引检查和最终 `bun run check --full`，核对锁文件及打包结果一致。
- [ ] 2.11 全文检索候选 `bun run vibe-check`、旧 check-plan API、旧脚本和已退役测试引用，证明旧门禁完全退出，最终只有 Vibe `bun run check` 能形成权威结果。
