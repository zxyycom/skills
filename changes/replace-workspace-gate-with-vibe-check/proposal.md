# Proposal

本 Change 将当前可选的 Vibe Check 候选入口收敛为项目唯一权威门禁，并以旧门禁实现和候选入口完全退出作为完成边界。迁移按门禁责任和可验证结果验收，不要求复制旧实现的任务形状与交互细节。

## Why

当前 `bun run vibe-check` 已证明 `@zxyycom/vibe-check` 能在本仓库运行，但它还没有承接项目结构、领域一致性、代码质量、行为测试、生成一致性和打包安全等现有门禁责任。直接切换会丢失必要覆盖。

当前工作环境已经能够解析 SCC 3.7.0 和 Lizard 1.23.0，指标 check 也已实际运行。环境审计已经固定 owner：`scripts/environment.js` 检查本地全局 prerequisite，`docs/tooling.md` 给出恢复命令，现有 CI package job 固定安装并探测相同版本；门禁 invocation 只使用已就绪工具，不联网安装。

反过来，把现有 31 个任务、quick/full 映射、任务 ID、输出顺序、`--verbose` 和并发环境变量逐项复制到 Vibe Check，也会把旧编排实现当成目标契约，抵消使用新工具简化配置、聚合和报告的价值。现有任务只作为责任盘点输入；每项责任必须得到“保留、Vibe 原生替代、合并或退役”的明确结论，但不默认要求一对一迁移。

## Outcome

- `bun run check` 成为唯一权威门禁入口，由 Vibe Check 负责调度、结果聚合和退出状态；CI 继续在原 job 中调用这一入口，不新增并行门禁。
- 建立门禁能力清单，覆盖仓库/领域一致性、代码与测试质量、生成一致性和发布打包安全；现有任务逐项留下处置理由和验证证据，不因迁移静默丢失责任。
- 默认检查与 `--full` 继续分别服务日常反馈和 CI/发布；迁移表已固定 default 的 25 项项目能力、full 新增的 6 项项目能力和两者共同的六项 Vibe 检查，不保留旧 task object、顺序、逐项 skip 文案或 renderer。
- 优先采用 Vibe 原生 check、progress、scheduler 和 aggregate；只有无法由原生能力可靠承接的项目检查才使用轻量 package-script adapter，不复刻旧 renderer 或内部计划模型。
- 发布选择中的任一必需检查无法形成可信通过结果都会使最终退出失败；`pack:skills` 只在全部发布前置责任通过后执行一次，前置失败时不产生本次打包写入。
- 六类 Vibe 检查全部进入最终门禁：重复、JSON、已验证兼容的 JSON Schema 和 Markdown 链接 finding 为 blocking；文件/函数指标 finding 永远只作为 advisory，不参与通过、退出或打包判断，但两项指标检查必须成功执行，SCC/Lizard 缺失或版本不兼容会阻断。
- Default selection 不运行或检查 `pack:skills`，只有 full selection 在全部发布必需检查 passed 后执行一次打包。
- 切换完成后删除旧编排、旧计划模块和候选 `vibe-check` package script，迁移仍有效的测试与 Test Evidence，并让现有 CI 直接使用新门禁。

## Scope

### Intended Change

- 盘点现有门禁任务所保护的能力、消费者和失败风险，为每项任务记录 retain、replace、merge 或 retire 结论；只有仍属发布必需检查的责任进入最终 full 选择。
- 用 Vibe 原生能力承接可可靠覆盖的通用检查；为剩余项目脚本建立最小 adapter，并按能力而非旧任务布局组织 check ID 和依赖。
- 保留一个实现入口下的日常与发布选择；选择结果必须说明本次覆盖范围，但不复制旧任务计数、输出格式、`--verbose` 或 `CHECK_CONCURRENCY` 契约。
- 将 `pack:skills` 建模为发布选择的依赖终结 check，显式检查全部 blocking 与执行必需的 advisory check 状态后再产生副作用。
- 让 `scripts/environment.js` 精确探测 SCC 3.7.0 与 Lizard 1.23.0，把两者作为只检查、不自动安装的本地全局 prerequisite；现有 CI package job 固定安装并探测相同版本。已经满足契约的环境直接复用，指标 finding 永不阻断，检查 unavailable 或意外 N/A 则 fail closed。
- 在旧门禁仍可调用期间，以能力覆盖、失败阻断、诊断可行动性和打包边界比较新旧入口；满足目标结果后切换原 package script 与原 CI job，不新增并行 CI job。
- 删除旧实现和只验证旧内部形状的测试，更新项目配置校验、工具文档、长期决策和每个受影响的 Test Evidence case。

### Resulting Impacts

- `scripts/vibe-check.ts` 从候选脚本成为权威 CLI，`scripts/lib/vibe-gate.ts` 承接能力目录、Definition 构造、package-script adapter 和打包 check，`scripts/vibe-check.test.ts` 承接新门禁测试；`scripts/check.ts`、`scripts/check.test.ts` 与 `scripts/lib/check-plan.ts` 退出。
- `package.json`、锁文件、`scripts/environment.js`、环境/项目配置测试和 `.github/workflows/package-skills.yml` 共同固定唯一入口、Vibe 版本、SCC/Lizard 精确版本与发布选择；本地环境只探测和复用，现有 CI job 负责固定安装。
- 原 `scripts/check.test.ts` 中仍描述公开门禁责任的 case 迁移到新实现；只锁定旧计划、格式或 helper 形状且不再属于目标契约的 case 删除。
- `docs/tooling.md` 从候选入口说明改为能力、选择、aggregate 和打包边界；建立 `use-vibe-check-as-authoritative-project-gate` Decision Record，归并并归档迁移表点名的五条旧编排决策。
- `docs/test-evidence/` 及统一派生索引随最小原生测试入口迁移，避免用旧任务数量作为覆盖完成的代理指标。

## Success Criteria

- 现有门禁中的每个任务都有可审计处置：保留或替代项指向最终 check 与测试证据，合并项说明共同 owner，退役项说明不再需要的消费者或被其他证据完整覆盖；不存在无结论删除。
- 最终发布选择覆盖已确认的仓库/领域一致性、代码与测试质量、生成一致性、六类 Vibe 检查和打包安全责任；默认选择固定为迁移表中的 25 项 `D+F` 项目能力和六项 Vibe 检查，必须明确未覆盖 6 项 `F` 能力与打包，不能声称等同完整发布门禁。
- 任一 selected blocking check failed/unavailable/N/A，或任一执行必需的 advisory check unavailable/N/A，都使 aggregate 和进程退出非零；文件/函数指标 finding 无论数量和数值都只形成 warning，永不改变 aggregate、退出状态或打包资格。独立检查能继续收敛，输出稳定表达 check、状态、原因和恢复动作即可。
- `pack:skills` 仅在全部发布必需检查形成 passed 结果后执行一次；指标 check 可以带 warning，但任一前置 failed/unavailable/N/A 时不执行，并由隔离输出测试证明没有本次打包写入；打包自身失败决定整体失败。
- 重复、JSON、Task Graph/Test Evidence Schema、Markdown 链接、文件指标和函数指标均有代表性 pass/finding/unavailable 测试；当前环境已安装的 SCC 3.7.0 与 Lizard 1.23.0 通过来源/版本探测，新工作区由环境检查与安装说明恢复，CI 在原 job 固定安装相同版本，门禁运行时不重复安装。
- 实际指标审计确认 59 条文件 finding 和 140 条函数 finding 都是可信、非阻断测量，没有 input rejection、blocking finding 或已有 waiver；文件 waiver 在 non-blocking policy 下不改变门禁结果，函数指标 0.0.1 也不提供 waiver API，因此本 Change 明确不配置 waiver，warning 继续可见。
- 能力处置表和验证证明新门禁已接管全部原有必要能力，代表性失败仍阻断且打包边界不放宽后即可切换；不设置自然日、连续运行次数或 revision 数量门槛，任务数量、ID、调度顺序和文本输出差异也无需一致。
- 干净安装后，现有 CI job 通过新入口的发布选择成功完成；不增加并行 CI job，也没有另一套上传或发布完成信号。
- 最终仓库只保留 `bun run check` 这一权威门禁入口；旧编排、旧计划模块、候选 `bun run vibe-check` 以及只验证旧实现的代码、文档和证据均已删除或迁移。

## Affected Owners

- 迁移处置证据：`changes/replace-workspace-gate-with-vibe-check/migration-matrix.md`
- 门禁实现与测试：`scripts/vibe-check.ts`、`scripts/lib/vibe-gate.ts`、`scripts/vibe-check.test.ts`、`scripts/check.ts`、`scripts/lib/check-plan.ts`、`scripts/check.test.ts`
- 项目命令与依赖：`package.json`、`pnpm-lock.yaml`、`scripts/environment.js`、`scripts/environment.test.ts`、`scripts/validators/project-config.ts`
- CI 与打包边界：`.github/workflows/package-skills.yml` 及现有 `pack:skills` 输出边界
- 维护文档与长期决策：`docs/tooling.md`、`docs/decisions/` 及其派生索引
- 测试证据：`docs/test-evidence/`、`docs/test-evidence/test-evidence-topics.json` 及统一派生索引
