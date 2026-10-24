# Gate 与 A/F 阶段正确性复核

## 结论

存在 **3 组阻断性输入/接线遗漏**。下列修复完成前，不能将当前 Gate 输入证明契约视为闭合。A/F 22 个 leaf 的本次改动未另发现阻断性正确性问题；没有提出风格或可选优化。

本次只读被审材料，没有修改源码、测试、Case、index 或长期文档，没有暂存、提交、安装或远端写入。只新建本报告。

## 阻断发现

### G1 — Test Evidence 项目侧三项 Check 丢失自身实现与测试输入

- 位置：`scripts/lib/vibe-gate/impact-tools.ts:349-355`；消费接线见 `scripts/lib/vibe-gate/checks/semantic.ts:384-403`。
- `domainRuntimeInputs` 删除 `scripts/**` 后，`test-evidence` 没有补 `scripts/test-evidence/**`。但 project-snapshot、project-reference-check、migration 三项分别直接运行该树的 `snapshot.test.ts`、`check.test.ts`、`migrate.test.ts`，并实际导入同树实现、helper 和子测试。
- 影响：仅改变 `scripts/test-evidence/snapshot.ts` 等实际输入时，这三项各自订阅的能力 digest 不变，可以复用旧证明。`script:test:check`、environment、typecheck 等其他 Check 被触发并不能替代这些 Check 的证明。
- 最小修复：在 `test-evidence` 能力补实际项目侧 adapter/测试树，或将该树分成现有模型内的独立能力并给三项订阅；不需要恢复全部领域的 `scripts/**`。
- 回归：三个直接入口实现/测试或 helper 单独变化时，对应 Check 必须 execute；无关维护脚本仍可保持裁剪效果。

### G2 — 新 frontmatter 回归把真实源码 CLI 带入窄 record Check，却未补输入

- 位置：`scripts/lib/vibe-gate/checks/semantic.ts:123-130`；`tools/decision-records/tests/checks/record-and-established-graph.ts:14`；`tools/decision-records/tests/source-frontmatter-reuse.test.ts:210-243`。
- 新 leaf 的 `Decision sync rejects malformed fresh bytes without publishing an index from an earlier parse` 实际在第 231 行调用 `runSourceCli(["sync-index", ...])`；`tests/support.ts:176-180` 动态加载 `src/cli.ts`。record Check 仍只订阅 decision-record-tests、decision-record、relation-graph，不含实际 CLI/query/maintenance/stage/search 运行闭包。
- 独立的静态漏项也仍在：`src/scan-snapshot.ts:7-10` 值 import `decision-strict-preparation.ts`，但 `impact-tools.ts:33-37` 的 record runtime 没有它。此项先于本次存在，仍属于当前实际加载闭包；不能因函数默认不走 capture 分支而当作 type-only/未加载。
- 影响：`src/cli.ts` 或 `src/decision-strict-preparation.ts` 单独变化不改变这个 Check 的任何订阅 digest；即使这些变化使该 Check 失败，也可复用旧证明。
- 最小修复：把上述 CLI 原生节点归入已有 source CLI Check（保留其独立观察），或给 record Check 补实际 CLI 闭包；同时在 record runtime 显式纳入 `decision-strict-preparation.ts`。仅迁移 CLI 节点不能修复后者。
- 回归：CLI 节点最终 consumer 对 CLI 实现单独变化 execute；record Check 对 strict-preparation 单独变化 execute；保持源 CLI 与真实分发证明分工，不添加无必要生成 provider。

### G3 — orphan validate 接入 environment 后缺少 skill-validator 源码输入

- 位置：`package.json:25`、`scripts/lib/vibe-gate/impact-tools.ts:204-209`。
- `test:environment` 本次新增 `scripts/validate.test.ts`，它导入 `scripts/validate.ts`；后者第 4 行值 import `tools/skill-validator/src/validation.ts`。environment 能力没有此源码；共同能力也未覆盖它。
- 影响：只改 skill-validator 的结构校验实现时，新增的健康基线、坏链接跳过和独立结构错误回归可被旧 environment receipt 复用。其他 validator Check 执行不替代这两个原生节点。
- 最小修复：给 environment 补实际 skill-validator 源码闭包（当前静态漏项仅 `validation.ts`）；不需要生成 provider，因为该入口消费源码。
- 回归：该源码变化选择 `script:test:environment`，同时正常新入口仍由公开 `test:environment` 发现。

## 依据与已核边界

- 已读项目导航、编码规范、Gate authoring、Test Design/Test Evidence Review 契约，以及当前 proposal/design/tasks/findings、两份 handoff 和原审计汇总/独立复核；按当前 diff 核对，不把原撤回项重报。
- 实际运行的是轻量只读诊断，不是测试：固定 Bun 1.4.2、`TMPDIR=/var/tmp`，用 Bun.Transpiler 提取候选，以 Gate 实际 `createProjectFileRegionIndex` 和当前订阅匹配。上述 6 个具体探针（TE 三个实现、DR CLI/strict-preparation、validator）全部得到 `matchingTools: []`。
- 静态候选展开 wrapper 顶层 import、跳过函数内 lazy 和 type-only 后，其余 semantic Check 没有新增未匹配的静态 import 候选。此结果不冒充完整动态读取 trace；G2 的 lazy 路径由实际测试调用人工闭合，而非仅凭候选报缺陷。
- 当前 provider 修复、共同事务/reader/双域 worker 归位、源 CLI/分发分工、leaf access 保留、typecheck/lint 保守 TS/MTS 输入与 formatter 分离、AST catalog、原生 duration CLI 消费、quick 原预算及 release/video 责任未发现本次额外阻断。
- A/F 核对保留真实 Node 类型/分发、两方向 mode、预算/深链/frozen 入口；下沉只影响无关边界；跨行、取消、现存 member drift、二进制 prefix/坏尾、updater 有更新只读与 publisher 注入命中观察均与 handoff 相符。没有发现为测试改变产品阈值或读取语义。

## 未覆盖

未跑 runner、变异、全 Gate、跨平台或真实安装；不声称动态通过。D/E 尚在执行的 leaf 不在稳定交付审查范围；records 产品语义由另一路复核。Case/index 与长期文档同步、最终 typecheck/changed/release/同 revision Windows 验收是已知后续工作，不作为本次发现。G1–G3 是源码层闭合的输入契约问题，不声称当前最终 Gate 或发布已实际错误通过。

## G1–G3 修复定向复核

**修后结论：G1–G3 均已闭合，本次定向复核无剩余阻断。** 上文保留的是修复前发现，不表示修后仍存在缺口。没有重新普查全仓或改动其他会话材料。

- **G1 已闭合**：`test-evidence-project` 显式包含 `scripts/test-evidence/**`，只由三个实际项目侧 consumer 订阅；核心与分发 consumer 没被无关扩宽。原三个遗漏实现探针现在均匹配 `test-evidence-project`。
- **G2 已闭合**：没有移动另一会话的新 leaf；当前实际 record consumer 已订阅 CLI/query/maintenance/stage/file-text-search 闭包。`decision-strict-preparation.ts` 也独立补入 record runtime，不仅借用 maintenance 输入。原 CLI 探针匹配 decision-cli，strict 探针同时匹配 decision-record/maintenance。针对 `src/cli.ts` 的值 import 传递闭包，使用该实际 consumer 的订阅匹配，未匹配列表为 `[]`。sync-index 不进入 search 专属动态输出分支，无需为此添加 record-search-output 或生成 provider。
- **G3 已闭合**：environment 显式包含 `tools/skill-validator/src/validation.ts`；其当前 Markdown/Node 静态依赖已有公共覆盖。原遗漏探针匹配 environment，没有引入生成 provider。

三个新增回归的输入均是明确路径和独立动作预期：先通过现有 `prepareChangedFixtureActivation` 写健康输入、调用真实 activation/成功 receipt 发布，再只改目标字节、重新规划；分别断言三个 TE project Check、实际 DR record Check、environment 自己的 execute，而不是以其他 Check 执行替代。TE 的 core/public-boundary reuse 与无关脚本 reuse、environment 的无关 CP reuse 也保留裁剪证据。原 `impact.test.ts` 已注册该责任测试文件。无生成前置断言只排除统一生成 provider，不锁死其他合法前置。

本轮实际执行仍仅为固定 Bun 1.4.2 / `TMPDIR=/var/tmp` 下的只读 matcher/静态闭包诊断，没有重跑 runner；6 个原遗漏探针均已匹配。Gate owner 在 handoff 记录的 **21 pass + 2 pass** 是其提供的运行证据，本复核只核实现/回归有效性，不冒称独立重跑。Case/index、领域动态命名修复、全 Gate 和跨平台边界仍按原整合分工推进，不据此宣布整个 Change 完成。
