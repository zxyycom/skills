# 文档优化交接

本文件记录本 Change 最终验收前的 AI-ready 文档优化，随 Change finalize 删除。只写两个长期 owner 与本 Change 的 proposal/design/tasks/findings；未改各 handoff/review 原始证据、代码、测试、Case/index、生成物、README 或 Decision，未 stage/commit/安装/远端写入。

## Owner 与实际调整

| 文件 | 调整与消费目标 |
| --- | --- |
| `docs/tooling.md` | 同步 69 total/66 base/58 receipt、输入与调度 identity；呈现共同协议/source CLI 责任、程序输入与生成信任边界，保留 quick10/原预算、full/CI 无 receipt、release 同快照及既有 Windows 链。PR 保护配置与已生效证据明确分开。 |
| `docs/gate-check-authoring.md` | 接入流程仍为主线；以真实消费选择 owner/输入/provider，区分源码 CLI 与真实分发、共同协议与两域 adapter、leaf 身份与保守字节覆盖。 |
| `proposal.md`、`design.md` | 保留 Change 固定结构和单一 Outcome；把已定方案从开放问题移入当前设计，剩余问题只留最终验收/远端配置。 |
| `tasks.md` | 当前22/24：Readiness与Implementation全部完成，Verification完成2.1–2.5；每组附handoff/review/隔离验收依据，最终CI/Windows和交付未勾。 |
| `findings.md` | 计划处置改为实际采用/收窄/保留/不实施及未验证边界；保留原 145 个逐节点来源键，按 99 个原文件路由聚合，精确名称/运行不再复制 handoff。首轮由257行收敛为206行，后续只补当前验收和回应指针。 |

核对了当前源码、Definition/订阅、wrappers/run、已安装 API 责任与原始交接，不只使用任务消息摘要。三路正确性 review 无剩余阻断；G1–G3 修复已定向闭合。另一会话 frontmatter leaf 未由本方迁移，当前 record consumer 按其实际源码 CLI 补足输入；其产品工作与 11 个 Case 保留，最终暂存由 root 隔离。

长期决策门槛：共同 Check/source CLI 执行既有独立失败责任规则；typecheck/lint 质量与生成一致性之分，落实既有统一 provider 决策中的语义 consumer 边界，不新增 owner 或放宽验收政策。因此本轮不写 changelog 式 Decision，不扩大 README 修改。

## 代表性 AI 阅读验证

按最终文本独立回答下列实际任务，结论来自文本语义复核，不是另一个 agent 的独立实验：

1. **新增 Check 如何找到 owner，选择 inputs/provider？** 从 navigation 进入 Gate authoring，按证明契约/失败 owner 选原生、语义或 package 等类型；输入声明在 impact-tools、显式订阅在实际 catalog。沿值 import/动态读取纳入 fixtures、ignored、生成物和 manifests；语义行为依赖当前分发可信一致时添加统一生成 provider，纯源码 CLI 不因名称添加。答案可由推荐工作流、项目输入证明及按类型接入恢复。
2. **quick 为何不是完整验收？** tooling 明列固定10 eligible，领域测试、生成漂移与完整材料不在其责任；receipt 可复用但 quick 不发布。完成维护需 changed，CI/full 全 base，release 全 catalog，Windows 另验。total≥30s/P90≥10s/mean≥5s 任一失败，其余 scope report-only。
3. **源码类型检查与生成语义 consumer 有何不同？** typecheck/lint 对当前程序 TS/MTS/manifests 证明质量，不能证明源码→产物一致；语义分发行为 consumer 的统一 provider 先证明一致性。扩大实际输入不等于扩大 quick/provider；formatter 独立范围保持。
4. **如何重跑最小失败入口？** 先使用 CLI 的精确 argv 与 transcript；语义命令由 semantic.ts、package 命令由 package.json 查证。需要定位单个测试时按框架实际登记的最小原生入口/名称选择，容器不登记为 Case；需要邻近回归才进入领域 test:* 聚合。目标通过与整体验收分别报告。

上述答案未依赖临时审计路径或口头摘要。长期文档保留流程与当前契约，临时发现/首次失败留在 Change；精确 API 继续按随包文档按需读取。

## 机械检查与交接

首轮固定Bun1.4.2、Node v24.18.0、`TMPDIR=/var/tmp` 实际执行：

1. `bun run change-plan -- check changes/align-checks-with-test-evidence --json`：`valid: true`、diagnostics 空，Plan 8/24；base 为 `ac40e50c…`，HEAD `a661d059…`，Change 外 Git 距离 0 commit/0 changed lines。该 CLI 只证结构/基线与 checkbox 声明。
2. 用已安装 `@zxyycom/vibe-check@0.0.4` 的公开 `run`/`markdownLint`/`markdownLinkValidation`，仅选择上述 7 个修改文件；沿用项目六项 lint 规则与 blocking policy，关闭 machine/progress/diagnostic 输出及缓存。两项均 passed、0 findings：lint 7 sources，links 7 sources/63 occurrences/60 target reads。无额外长期或临时文件落盘。
3. 限定本 owner 路径的 `git diff --check` 通过；原逐节点来源键的集合核对完整保留 145 项。

未运行全 Gate、最终 typecheck/lint/test:check、正式 Case 检查、quick/changed/release 或 Windows；本阶段文档机械检查不替代这些验收。

当前实现/索引的隔离验收与剩余交付统一见[验证记录](verification.md)；文档机械检查只是本代理实际执行的限定范围，不代替root的完整Gate。
## 隔离验收定向修复后的补充

本次仅补缺失事实与状态，不重写长期接入规则或原始 handoff/review。`tooling.md` 的 catalog 输入边界补两域人工 run 的精准能力和两个实际 consumer；authoring 已有完整实际消费/订阅规则，不重复增加案例。新能力不扩大领域 leaf 或 TE 临时 workspace 单元测试的输入。

代表性 AI 阅读追加两项：

1. 两域人工 `run.ts` 变化时，从 tooling 可恢复其由 `decision-test-catalog`/`investigation-test-catalog` 归属，仅实际 catalog 自测与真实 Case 采集订阅；由 Gate 回归恢复 incremental、无未归属输入、域 leaf 复用。不是恢复整域广订阅。
2. 从 verification 可分别恢复初次 tree 的 1677/typecheck/104+1skip/冷 quick 通过、首次 changed 的 file/function/权限三失败、输入回退两来源，以及“环境已修、目标已过、最新完整快照未验”。初次混合 1688 与隔离 1677、原 tree 与后续增量均未合并成一次通过。

实际读取了新 catalog 能力/订阅与回归、Gate/代码优化追加及首轮隔离验收日志；没有重新执行这些测试。27 目标及九文件原生指标零 finding 保持原 handoff 的数字与范围，环境只替换本轮自建依赖软链接并离线安装，不改产品或权限。该次定向同步未改checkbox；后续按精确快照证据逐项完成声明，见下节。

该次固定运行时下Change Plan check通过、8/24；限定本次六个修改文件的原生 Markdown lint/links 均 passed、0 findings，git diff --check通过。这些机械证据不取代最新快照 changed/release/CI。未 stage、运行全 Gate或新增长期决策。

交付前再读Case追加：后续修复已形成混合1691实体及引用/覆盖通过，本方选择集合163 ID；Plan/verification/findings同步该状态，仍保留初次159-ID隔离1677通过的准确历史边界。

## 本方精确快照的任务完成核对

本轮按最终范围复核、原始handoff/review、最后代码优化及root的精确运行结果，逐项复核0.1、全部Implementation、2.2–2.4；该轮完成21/24；后续同tree Linux冷release69/69通过并完成2.5，当前22/24，仅剩最终相关revision远端/Windows与最终交付。1.13生成/版本责任按cached无skill/runtime源码/build adapter变化判为无需新增同步或提升，本轮统一生成provider仍实际通过。

AI语义复核可从tasks的完成依据恢复每项勾选来源；从verification区分混合1691/初次隔离1677/当前隔离1680，以及当前tree与后续文档增量。changed首次三失败、精确输入修复、最终66通过/58receipt、重复复用及quick5实际/5复用均各自留证，release按后来实际完成的69/69结果勾选，不向远端/Windows外推。没有发现需用户选择的实施缺口，剩余验证由root接续。

本轮只改本Change五份文档，不改长期owner、Case/index或源码，不stage/commit，不重复全Gate。固定运行时实际执行Plan check：valid=true、21/24、无diagnostics；限定五文件原生Markdown lint/links均passed、0 findings（links30 occurrences/30 target reads），git diff --check通过；本轮记录增量不属于已受测tree `0f06721a…`，仅有文档变更不能冒称该tree已包含它们。

本次release短增量已读取实际日志并核对同tree/基线/版本/pack边界，未重复运行Gate；只补2.5完成与剩余2.6/2.7。实际Plan check valid=true、22/24；限定五文件原生Markdown lint/links均passed、0 findings（31 occurrences/31 target reads），diff-check通过。
