# Tasks

任务先把旧任务转换成能力处置结论，再实现更小的 Vibe 门禁；验收比较责任、失败与副作用，不比较旧任务数量和文本输出。

## Readiness

- [ ] 0.1 在 Change 目录建立 `migration-matrix.md`，盘点现有 31 个项目任务并为每项记录能力、owner、失败风险/消费者、retain/replace/merge/retire 处置、最终 check/选择和验证证据；任何空白处置阻止切换。
- [ ] 0.2 从处置表形成 default 与 full 能力集合，固定 blocking、required advisory、release-required 和 full-only `pack:skills` 边界；文件/函数指标属于两种选择共同的 required advisory check，不沿用旧任务数量作为验收标准。
- [ ] 0.3 盘点 `scripts/check.test.ts` 及 Test Evidence，区分需要迁移的公开责任与可以随旧计划、renderer、参数或任务计数一起退役的实现断言。
- [ ] 0.4 验证 Vibe config/run、selection、scheduler、direct dependency、aggregate、RunResult、指标 warning 与 unavailable 结算和 output 开关足以承接目标，只为实际使用的 0.0.1 API 建立契约测试。
- [ ] 0.5 固定 default/full、领域失败、代码检查失败、Vibe blocking finding、指标 advisory finding、SCC/Lizard unavailable 和打包失败的能力级对照夹具；不新增并行 CI job。
- [ ] 0.6 按 AI-Ready Docs 审阅能力处置表、选择边界、retire 理由、失败诊断和操作者恢复动作，确保“不要求一致”不会被解释为允许无证据删减。

## Implementation

- [ ] 1.1 将 `scripts/vibe-check.ts` 收敛为薄 CLI 与 Vibe 配置，保留 default 和 `--full` 两种用途，删除没有当前消费者证据的 `--verbose`、`CHECK_CONCURRENCY` 和旧摘要兼容层。
- [ ] 1.2 接入重复、JSON、Task Graph/Test Evidence Schema 和 Markdown 链接 Vibe 原生 check，并用代表性 fixture 证明 finding/unavailable 能进入 blocking aggregate。
- [ ] 1.3 接入文件/函数指标 Vibe check 作为 default/full 共用的 required advisory check；finding 产生 warning 并 passed，unavailable/not-applicable 使 aggregate failed。
- [ ] 1.4 在 `scripts/environment.js`、环境测试和现有 CI job 中加入 SCC 3.7.0-compatible 与 Lizard 1.23-compatible 的固定版本安装、探测、幂等和可操作失败诊断。
- [ ] 1.5 实现最小可注入 package-script adapter，使用参数数组启动 Bun，分类非零退出与 unavailable，保留受控诊断，并把聚合、调度和展示交给 Vibe。
- [ ] 1.6 按能力处置表只为 retained 或无法原生替代的责任建立 check；允许重命名、合并和重排，但每个 release-required check 必须进入 full aggregate。
- [ ] 1.7 使用 Vibe 原生 scheduler，并只按资源测试设置静态 `maxParallel`/mutex；不重建旧动态并发环境变量或第二套任务状态机。
- [ ] 1.8 实现 full-only `pack:skills` check，依赖全部 release-required check；只有全部 passed 才调用一次打包，其他 terminal 状态都不产生本次打包写入。
- [ ] 1.9 使用 Vibe progress 和结构化 RunResult 完成状态、原因、恢复动作及最终退出；只有发现可复现的诊断缺口时才增加薄 formatter，并保持 machine artifact 默认关闭。
- [ ] 1.10 将仍有效的选择、aggregate、失败、继续执行、指标、诊断和打包测试迁移到新模块/fixture；删除只锁定旧任务计数、顺序、renderer 或 helper API 的断言。
- [ ] 1.11 在旧入口仍有效时运行临时 `bun run vibe-check` 的 default/full 与故障对照，修复必要能力缺失、错误成功或打包越界，不修复无契约价值的文本和任务形状差异。
- [ ] 1.12 对照通过后让 `package.json#check` 指向 Vibe 入口，保留现有 CI job 的 `bun run check --full`，并移除临时 `package.json#vibe-check`。
- [ ] 1.13 删除旧 `scripts/check.ts`、`scripts/lib/check-plan.ts` 及只验证旧实现的代码，更新 `scripts/validators/project-config.ts` 使其要求唯一权威入口。
- [ ] 1.14 更新 `docs/tooling.md` 与相关仓库说明，记录能力组、default/full、blocking/required advisory、SCC/Lizard、Vibe 原生输出和 full-only 打包，不保留旧任务清单作为规范。
- [ ] 1.15 建立项目级 Decision Record，记录能力级替换、六类 Vibe 检查、full-only 打包和不设并行 CI job，并关联或调整既有 aligned 决策及索引。
- [ ] 1.16 逐项迁移、合并或删除受影响 Test Evidence case，同步 topic 与统一派生索引；retire 的 case 必须能追溯到能力处置表理由。

## Verification

- [ ] 2.1 审计能力处置表，证明旧 31 个任务全部有 retain/replace/merge/retire 结论，且每个 release-required check 都可追溯到最终 check 和最小原生测试证据。
- [ ] 2.2 验证 default 只声明日常覆盖、full 选择全部 release-required check，且两者都运行文件/函数指标；不断言旧任务数量、ID、顺序、逐项 skip 或摘要文本。
- [ ] 2.3 注入领域、代码、Vibe blocking check 及 adapter 的 failed/unavailable，证明 aggregate 和进程退出非零，其他独立 check 仍能收敛且诊断可定位下一步。
- [ ] 2.4 用调用计数与隔离输出目录验证 default 不打包，full 全部 required check passed 时只打包一次，任一前置非 passed 时零调用、零本次制品写入，打包失败决定整体失败。
- [ ] 2.5 验证六类 Vibe check 的代表性 pass/finding/unavailable：指标 finding 只 warning，SCC/Lizard 缺失或版本不兼容使 aggregate failed 并跳过打包。
- [ ] 2.6 在无预装 SCC/Lizard 的干净环境执行标准 setup 两次，证明兼容版本、幂等和修复诊断；随后成功运行文件/函数指标。
- [ ] 2.7 验证 Vibe 原生 progress/结果足以表达 check、状态、原因和恢复动作，结构化测试不依赖整段自然语言；machine artifact 未意外落盘。
- [ ] 2.8 在相同 revision 上完成旧/新能力级对照，证明必要责任无静默弱化、代表性失败仍阻断、full 打包边界不放宽，并显式接受任务与输出形状差异。
- [ ] 2.9 从干净安装运行现有 CI 等价路径和 `bun run check --full`，确认同一 job、唯一 aggregate、可用指标工具与经 full 证明的 skill 包，不存在并行 job 或第二完成信号。
- [ ] 2.10 运行新门禁定向测试、环境测试、项目配置、Test Evidence、Decision Records、生成/索引检查和最终 `bun run check --full`，核对锁文件及打包结果一致。
- [ ] 2.11 全文检索临时 `bun run vibe-check`、旧 check-plan API、旧脚本和已退役测试引用，证明旧门禁完全退出，最终只有 Vibe `bun run check` 能形成权威结果。
