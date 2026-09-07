---
title: "Vibe Check 的语义 Case 账本与测试实体闭合实践"
id: "260907-investigate-vibe-check-test-evidence"
formedAt: "2026-09-07T06:23:31+00:00"
question: "Vibe Check 对 test-evidence-review 的定制及实际使用如何工作，对主仓库拟议的 Case 与 Test 多对多边界有什么启示？"
tags:
  - "project-customization"
  - "test-evidence"
  - "vibe-check"
relations: []
---

## 形成时背景

主仓库正在讨论重构 `test-evidence-review`：倾向由接入项目的 API 负责测试实体是否存在、采集和解析，核心 skill 只维护独立 Case 的证明点及其关联测试实体 ID；讨论中的关系是 Case 与 Test 的多对多，而非已实施事实。本轮需要核实 Vibe Check 是否长期使用过不同的 test skill，以及其实际 Case、证明点、实体 ID、采集与校验边界能提供什么可复核材料。

本报告形成于 2026-09-07。调查对象为来源项目 `vibe-check` 的工作树快照：提交 `9ee0263e205f0d963aa773f2caa97abf1b764b9c`（2026-09-07T03:23:19Z）。调查时该工作树有 119 条未提交路径；本文用到的 `.codex/skills/test-evidence-review/SKILL.md`、`docs/testing/case-maintenance.md`、`scripts/test-evidence/**` 和 `docs/testing/cases/test-infrastructure.md` 未显示为已修改。两个用于展示同一实体关联多个 Case 的 Case 文件 `docs/testing/cases/quality-runtime.md`、`docs/testing/cases/scan-configuration.md` 则处于已修改状态，故该样本只证明调查时工作树的实际查询结果，不证明其内容已进入该提交。

## 调查目的

回答以下问题，并限定为事实追踪而非测试质量审查：

1. Vibe Check 当前使用的 skill 来源、入口和相对于主仓库当前 skill 的差异是什么？
2. 项目如何定义、存储、查询和校验 Case、`Proves` 与测试实体 ID；哪些责任由项目 API 承担？
3. 真实 Case、实体关联和失败边界怎样工作，Git 历史是否支持其持续采用？
4. 对主仓库仍在讨论的核心/项目 API 分界及 Case↔Test 多对多关系，有哪些可采纳与不可直接移植之处？

不修改来源项目，不创建测试账本 Case，不审阅所有现有测试的质量，也不把讨论中方案表述为已经实施。

## 调查范围与依据

### 方法与实际动作

- 已读取 `vibe-check` 的 `AGENTS.md`、`docs/navigation.md`、`docs/testing/case-maintenance.md`、vendored skill、`package.json`、相关 TypeScript 源码和少量目标测试；调用 CodeGraph 读取调用关系和现行源码。
- 已执行只读查询：`bun run test-evidence -- topics --root .`、按 `test-infrastructure` topic/文本/实体 key 的 `list` 查询。`topics` 返回 `status: "ok"`、无诊断、15 个 Topic 和合计 126 个 Case。
- 未运行 `bun run test-evidence -- check --root .`：该命令会启动完整 Bun registration child，虽以不匹配 pattern 要求 testcase skipped，仍会加载完整测试面；本轮只读授权下没有把它当成无副作用查询执行。也未运行任何产品测试、未安装依赖、未修改或写入来源项目。

### 主要来源

除非另有说明，以下 locator 均相对 `vibe-check@9ee0263e205f0d963aa773f2caa97abf1b764b9c`：

- 项目接入规则和 vendored skill：`AGENTS.md`、`.codex/skills/test-evidence-review/SKILL.md`；后者最后两次提交为 `08e819edf3ef0f8422ee4f1addb512693055cb84`（2026-07-30）和 `e10eac9ce2d6c4045b8fec51cf3cece20c618888`（2026-07-27）。
- 项目账本契约：`docs/testing/case-maintenance.md`，以及 `docs/testing/cases/topics.json`、`docs/testing/cases/test-infrastructure.md`。
- 项目 API 与校验：`scripts/test-evidence/command.ts`、`cases.ts`、`catalog/{source,markdown,owner-ref}.ts`、`discover.ts`、`discovery/{bun,bun-files}.ts`、`closure.ts`、`profile.ts`；Gate 接入在 `scripts/project/gate/checks/test-evidence/semantic-case-check.ts` 和 `scripts/project/gate/definition.ts`。
- 样本与失败边界：`scripts/test-evidence/{catalog,closure}.test.ts`、`scripts/test-evidence/discovery/profile.test.ts`，以及上述 Case 文件；多对多样本同时是已修改工作树文件，详见形成时背景。
- 持续性证据：`08e819e` 一次创建/重构 49 个相关文件并建立全树闭合；`docs/testing/case-maintenance.md` 的历史从 2026-07-08 延续至 2026-09-05，`scripts/test-evidence/command.ts` 的历史延续至 2026-08-26，`docs/testing/cases/test-infrastructure.md` 的历史延续至 2026-09-05。`db06bc205453c671c87383ea26b4a3654de9939c`（2026-09-05）重组 admission 调度测试时同时更新 `docs/testing/cases/quality-runtime.md`。

## 调查结果与边界

### 已确认事实

1. **Vibe Check 使用的是 vendored 的项目定制 skill，而非当前主仓库版本。** 项目 `AGENTS.md` 要求测试或 Case 变动使用 `test-evidence-review`，实际文件是 `.codex/skills/test-evidence-review/SKILL.md`。该文件没有当前主仓库 `metadata.version: "24"`，其最后内容提交在 2026-07-30；它把项目文档、runner 与项目 API 视为 Case 存储、Topic、查询和严格检查的 owner。它明确允许“一个测试按项目规则继续支持多个 Case”，并禁止为了账本而拆测试。相对当前主仓库仍规定“一最小原生测试入口一 Case”的版本，这是实质性差异，而不是仅路径或措辞不同。

2. **Case 保持独立的语义单元，而非证明点或实体的分类容器。** 项目 owner 将 Case 定义为稳定 ID、一个 `Owner` 文档 heading、一个或多个当前实体和一个或多个 `Proves`；Topic 仅是有界查询分类。源码中的 `SemanticTestCase` 正是 `{ id, title, topic, ownerRef, entityKeys, proves, sourcePath, sourceLine }`。topic Markdown 每个 H2 Case block 按固定顺序保存 `Owner`、`Entities`、`Proves`；parser 拒绝缺失/空字段、重复实体、错误 heading 等结构。`Proves` 是 Case 内的语义 bullet，不是独立 ID、实体或第二套映射对象。

3. **Case↔实体已按多对多实际使用。** `validateTestCaseCoverage` 仅收集所有 Case 的 `entityKeys` 并要求每个当前实体至少出现一次；它不要求唯一映射，同时每个 Case 至少一个实体且不得引用未知实体。实际只读 `list --entity-key` 查询显示一个名为 `contains invalid callback outcomes and Record misuse in the owning Check` 的 Bun 实体同时属于四个不同 Case：`WB-RUNTIME-CHECK-LIFECYCLE-001`、`WB-RUNTIME-RECORD-MANAGER-001`、`WB-RUNTIME-CHECK-FAILURE-001` 和 `WB-RUN-RESULT-CHECK-MESSAGES-001`。前三者在 `quality-runtime.md`，最后一个在 `scan-configuration.md`；它们具有不同的语义证明目的，并跨越多个 Owner，其中前两个共用 `docs/development/check-results.md#check-and-record-facts`。可在来源项目根目录复跑以下只读查询：

```bash
bun run test-evidence -- list --entity-key 'bun|src/project-run/check-facts-record-misuse.test.ts|Package Run Check facts integration > contains invalid callback outcomes and Record misuse in the owning Check' --root .
```

这个样本来自已修改工作树，不能外推为提交 `9ee0263` 已记录内容，但查询实证其当时被项目 API 接受。

4. **项目 API 承担实体采集、解析和存在性校验。** `command.ts` 提供仅查询 Case 目录的 `topics`、`list`、`show` 和完整 `check`。完整检查先 `await discoverTestEntities`，再加载 Case catalog、合并二者诊断；只有 discovery 没有 blocking 诊断时，才校验未知引用和未映射实体。Bun adapter 从版本化 runner profile 解析受控文件面，用 ast-grep 找静态 `test` 声明，并以 `bun test ... --test-name-pattern=a^ --reporter=junit` 取得只注册且明确 skipped 的 JUnit 报告；以 `source path + line + name` 闭合静态与 runtime identity，最终把实体 ID 投影为 `bun|<target>|<selector>`。Case parser 同时验证 Topic 目录安全、Topic 表、Case 格式及 Owner Markdown heading；Gate 把此项目 API 接成 required 的 `test-evidence` Check，并投影安全诊断。

5. **三个真实 Case/失败边界样本说明其闭合不是纯 Markdown 检查。**
   - `AUX-TEST-EVIDENCE-CATALOG-001`（`test-infrastructure.md`）把两个 catalog test 实体合入一个 Case，证明 topic/owner/entity/text 查询以及非法目录、symlink、heading、Owner anchor、重复 ID/entity 与空语义会阻断。`catalog.test.ts` 构造这些非法 source 并断言相应诊断。
   - `AUX-TEST-EVIDENCE-CLOSURE-001` 把两个 closure test 实体合入一个 Case。`closure.test.ts` 验证唯一静态+runtime 身份得到稳定 key，而 static-only、runtime-only 和任一侧重复 identity 产生阻断诊断。
   - `AUX-TEST-EVIDENCE-DISCOVERY-001` 用四个实体证明 profile、文件面和 JUnit registration 边界。`profile.test.ts` 拒绝缺失 testcase、不是全 skipped 的 registration report、空 source root 与越界 glob；`bun-files.ts` 还拒绝未命中 include、无文件面和重复 supplemental file。

6. **持续性有 Git 支撑，但 vendored skill 本身不是持续同步的证据。** 2026-07-30 的 `08e819e` 建立语义 Case/全树闭合实现和文档；其后项目 owner、CLI 和 Case 文件继续随重构调整，最近可见记录到 2026-09-05。反之，vendored skill 自 2026-07-30 未再提交，不能把它当作对当前主仓库 skill 的同步版本或未来兼容承诺。

### 对当前讨论的推断与建议

- **支持的方向：** Vibe Check 是“项目 API 拥有实体 discovery、runner 解析、存在性与闭合”的现实例子。它的 `entityKeys` 与 Case 内 `Proves` 已展示 Case↔Test 多对多可保持 Case 语义独立：同一实体可支持数个不同 owner/证明目的，多个实体也可共同支持一个 Case。
- **关键边界差异：** Vibe Check 的定制 skill 连同 Case 存储、Markdown 格式、Topic、查询和严格检查都交给项目 owner；这不能等同于当前讨论的方向。后者拟由核心保留 Case/证明点/实体引用的模型，项目 API 仅负责测试实体事实（存在、采集、解析及其验证）。因此可以借鉴其项目级实体适配与多对多使用证据，不能把完整 Case 模型也下放到 API。
- **建议保留的核心边界：** 若后续实施该方向，核心 skill 应把 Case ID、Case 所拥有的证明点集合及关联 test entity ID 作为最小语义表面；不要把每个证明点提升为独立实体映射，也不要从 Vibe Check 的多实体 Case 倒推出 Case 只是 Topic/测试文件容器。项目 API 应明确返回/验证它所承诺的实体集合、ID 稳定性和失败语义。
- **不可直接移植：** Vibe Check 的 `bun|target|selector` 格式、ast-grep 规则、JUnit 全 skipped registration、路径/line/name join、全树 fail-closed closure、Topic Markdown 布局、JSON CLI、Gate diagnostic projection及其固定 `docs/testing/cases` owner，都是该项目的适配层，不应被核心 skill 隐式规定。其要求“每个当前实体至少关联一个 Case”也是项目的全树策略，不自动成为通用核心义务。
- **状态边界：** 上述建议只依据调查，不授权实现，也不改变当前主仓库仍为“一入口一 Case”的已发布 skill 文本；讨论中的多对多设计仍需独立的契约和迁移判断。

### 未验证与重新调查条件

本轮没有执行完整 `check`、任何目标测试或 Project Gate，因而没有证明 `vibe-check` 工作树在该时点的完整静态/runtime/Case 闭合或测试通过；`topics`/`list` 的成功只证明所读 catalog 可查询。来源项目的未提交变更也意味着重查时应固定新的 commit 或明确采用新的工作树快照。若主仓库决定实现项目 API 或修改核心 Case 模型，应重新调查至少一个非 Bun runner、API 的稳定输入/错误协议，以及现有主仓库账本迁移如何保留 ID、Case 语义和关联关系。
