---
title: "原生 Skill 搬迁后被已完成回执的恢复路径阻断"
id: "261109-native-updater-relocated-complete-receipt"
formedAt: "2026-11-09T10:37:25Z"
question: "为何完整安装的决策与调查 Skill 搬迁后检查升级会报 invalid native recovery directory，修复应保留什么恢复边界？"
tags:
  - "compatibility"
  - "native-cli"
  - "skill-updater"
relations: []
---

## 形成时背景

- 用户提供的症状是：两个已安装 skill 的 `.record-native-receipt.json` 仍指向临时安装位置，实际副本已经搬入宿主项目 `.codex/skills`，运行 updater `--check` 报 `invalid native recovery directory`。这是用户提供的现场描述，不是本轮直接读取的安装现场。
- 本轮工作区为源码仓库，开始时 Git 干净，基线为 `04805ac08f89f3cab20dfa0b2dc893c5c73811ce`；本地 `decision-records` 版本为 113，`investigation-report` 为 102。本轮未查询最新远端 release，不能据此断言线上最新版本身份。
- 问题跨越安装回执、保留资产证明、更新计划与恢复路径约束，且涉及搬迁与恢复边界；隔离对照与未读取现场的限制需要独立保留，因此按复杂 Bug 规则形成报告。初始检查点只调查，随后用户授权按当前包覆盖模型简化安装更新；实际结果见下文，用户安装现场始终未修改。

## 调查目的

- 判断问题是否仅由安装文件损坏引起，还是完整安装在正常搬迁后也会触发共同更新器缺陷。
- 确定触发阶段与版本条件，并区分只读检查失败、实际升级受阻和业务 CLI 本身不可用。
- 区分局部路径修复与安装模型简化的收益和边界；后续实施以用户选择的当前覆盖模型验收。

## 调查范围与依据

### 源码与运行条件

- 源码 owner 为 [Skill Updater](../../tools/skill-updater/README.md)。检查了 `native/cli.ts`、`native/native-plan.ts`、`native/legacy-resume.ts`、`native/legacy-state.ts`、`native/legacy-cleanup.ts`、`native/installed-evidence.ts`、`native/native-transaction.ts` 与 `native/native-resume.ts`。
- 两个 skill 的随包运行时都调用上述共同实现；对 `decision-records` 的随包 `native-plan.ts` 去掉生成头后与源码做了字节比较，结果相同。
- 本轮使用 Linux、Node.js v26.8.2、Bun 1.4.4。实验使用 release manifest、ZIP、长度及 SHA-256 一致的合成资产；二进制内容是 fixture 文本，`validatePrepared` 为空回调，未执行原生业务程序。
- 所有 release HTTP 响应在进程内替换，没有访问 GitHub。文件写入仅发生在本次 `mkdtemp` 树；包括最后的回执路径对照在内，全部实验副本结束时清理，未操作用户项目。

### 同轮历史补证（2026-11-09）

为回答回执是否为既有机制及其引入理由，另查完整 Git 历史。该补证仍回答本报告的根因与修复边界，不建立独立后继。下表为北京时间；Git 原始提交时间使用 UTC，以下只证明仓库演进，不证明远端发布时间或用户安装时间。

| 时点与提交 | 核实变化 |
| --- | --- |
| 原生交接前 | 前一代 TS updater 按 `metadata.version` 判断更新、覆盖 ZIP 中同名文件并保留其余本地文件；没有本轮涉及的 `.record-native-receipt.json`。 |
| 2026-11-08 21:20，`f93c439f` | 新增 `native/legacy-state.ts`、回执、受管旧文件交接及清理恢复。回执从首次实现即包含文件、hash、mode、完成状态和恢复路径。 |
| 2026-11-08 21:30，`f6ad4284` | 新增 `installed-evidence.ts`、保留资产证明及原生升级计划；明确不能单靠回执授权删除。此时计划尚没有本次致错的 `assertNoPendingRecovery`。 |
| 2026-11-08 22:32，`879689ab` | 接通原生安装与续清理；在计划中新增 `assertNoPendingRecovery`，无条件校验历史 `backup`。这是本次已复现的升级计划阻断逻辑的引入点。 |
| 2026-11-08 23:42，`fc37fa3b` | 增加同版本受管文件补缺及保守修复，进一步使用安装证据。 |
| 2026-11-09 02:23，`65dbe702` | 正式入口、skill 与检查切换到原生实现。该提交不是远端发布或用户安装生效证明。 |

主要复核入口：`git log -S '.record-native-receipt.json' -- tools/skill-updater/src`；`git show f93c439f -- tools/skill-updater/src/native/legacy-state.ts`；`git show 879689ab -- tools/skill-updater/src/native/native-plan.ts`；`git show f93c439f:changes/promote-native-record-cli/resources/delivery-contract.md`。已结项 Change 的材料从 Git 读取，不恢复到当前规范目录。

形成时理由由该交付契约的“安装与更新”说明：旧 updater 不准备二进制权限或清理旧 SDK；新方案要求激活前验证包与程序、激活后仅清理已验证的受管退役文件、记录文件及权限与完成状态，并能在清理失败后续接。回执是为这组新增安装更新能力加入的实现，不是原生二进制运行的必然前提。

[旧版覆盖更新判断](../decisions/use-versioned-overlay-skill-updates.md)明确不让目录 hash 或派生 package lock 参与版本判断；[原生交付判断](../decisions/261106-isolate-shared-native-record-candidate.md)增加平台、来源、版本及资产核验。已读材料解释了能力需求与采用的流程，但未单独证明“永久回执”相对其他表示不可替代；不能将真实需求等同于这一文件形态必然最优。

### 复现方法与对照

随附 `reproduce.sh` 保存形成时复现，应在上述基线的隔离 checkout 根运行。它依赖修前源码接口；当前实现已退出这些接口，不在当前工作树恢复旧模块或把旧症状断言作为成功标准。

1. 对两个 role 分别构造版本 200 的完整原生安装资产，通过真实 `activateNativeBundle` 完成安装。
2. 确认回执为 `complete`，且回执指向的恢复目录已不存在。构造版本 201 资产，在原位置生成升级计划，作为成功对照。
3. 仅将整个 skill 目录 rename 到另一父目录下的 `project/.codex/skills/<role>`，不改文件内容或 mode。
4. 在新位置运行 `verifyInstalledNativeEvidence`，然后通过真实 `runNativeUpdaterCli` 以 `--check --target-dir <新位置>` 检查合成新版本。
5. 将模拟远端改回已安装版本，复查同版本 `--check` 分支。另调用升级激活入口，检查是否同样受阻。
6. 确认上述调用没有改写回执。最后只把实验回执中的 `backup` 改成新目录同级且不存在的合法恢复路径，重新生成升级计划，作为单变量对照。这不是面向真实安装的恢复建议。

两个 role 的结果一致：

| 条件或观测 | 结果 |
| --- | --- |
| 完成安装、原位置检查升级计划 | 成功 |
| 搬迁后核验保留资产及当前受管文件 | 成功 |
| 搬迁后检查新版本 | 抛出 `invalid native recovery directory` |
| 搬迁后检查相同版本，旧恢复目录不存在 | `Status: current`，返回 0 |
| 搬迁后尝试激活新版本 | 同样抛出 `invalid native recovery directory` |
| 失败及同版本检查后回执字节 | 与搬迁前一致 |
| 只重绑实验回执的 `backup` 后生成升级计划 | 成功 |

### 其他验证

- `bun run test:skill-updater`：48 pass、0 fail。这只证明既有测试运行通过，不否定上述独立复现。
- 报告通过领域 CLI 发布并同步索引；`bun run investigation-report -- check` 验证 106 份正式报告，`indexState: current`，无 error 或 warning。
- `bun run check -- --scope investigation-collection`：公共 quick 基线及调查集合检查共 7 项通过；其余 56 项未选中。这不是全仓验收、真实安装恢复或上线证明。

### 同轮能力对照与回执可改性补证（2026-11-09）

以下均为修前基线对照：进一步核对普通 updater 的 `index.ts`、`installation.ts` 与原生 `native/cli.ts`、`native-repair.ts`、`installed-evidence.ts`，区分当时新增的行为与表示方式。

| 行为 | 相对原生化前的差异 | 是否必需永久回执 |
| --- | --- | --- |
| 独立版本判断、确认后覆盖、新增文件 | 旧方案已有 | 否 |
| 普通写入失败时备份并尝试恢复 | 旧 `applyStagedFiles` 已有；不能作为新回执独有收益 | 否，本次调用的临时状态即可服务该责任 |
| 原生平台资产选择与绑定、可执行权限、激活前程序校验 | 原生交付增加的实际适配 | 不由永久回执决定，可基于发布资产与安装流程完成 |
| 同版本核验受管成员、仅补齐缺失文件 | 修前原生入口新增；已有文件内容冲突时拒绝，不是任意损坏自动修复 | 可基于原始包及明确权限规则实现；当时的回执是实现输入，不是能力唯一可能的载体 |
| 仅删除已验证的旧版退役文件 | 新增，旧覆盖方案不删除额外文件 | 需要旧版本文件归属信息，但可来自旧包、清单等，不必将恢复位置永久混入其中 |
| 激活后清理中断，下次续清理 | 新增；不是完整崩溃自动回滚承诺 | 续接需要某种持久化事务信息，不必与完成安装共用永久回执 |

上述表格中的可替代表示是形成时基于数据来源的设计判断，不是该检查点已经实现并验证的替代 updater。完全恢复旧方案而不另行承接清理、补缺和续接责任，会失去相应行为，不能宣称功能零差异。修前的 `runNativeUpdaterCli` 在这些分支之前仍取远端 release 和资产，因此当时本地保留原包不等于已提供无需联网的公开修复入口。

回执没有不可修改的签名语义。安装校验会约束其角色、版本、文件集合、摘要和 mode；`backup` 不在 `proveEvidenceReceipt` 的上述成员证明中，而由恢复/计划阶段另行解释。已有复现只改变合成副本的 `backup` 后，安装证明与计划都通过，已经反驳“恢复路径写入后不能改”的说法。

本次补证在原复现实验的 `rebound` 计划断言之后，继续调用 `activateNativeBundle({ ...next, destination: moved, confirm: async () => true, validatePrepared: async () => {} })`，随后用 `verifyInstalledNativeEvidence` 核验新版本。两个 role 均完成版本 200 到 201 的激活，回执变为 `complete`，新恢复目录已清理。全部操作仍限于合成临时副本，二进制为 fixture，未验证真实业务启动或真实用户现场。随附原脚本保持形成时内容；该补证不是重写原历史材料，也不是修复后验收测试。

因此，有依据的路径元数据修正是可行选项；不存在因“回执不可修改”而必须重装的技术结论。但若真实安装仍有待清理目录，不能仅把路径改成不存在的位置假装完成，应核验并保全恢复材料。新增能力是否值得其成本，与永久回执是否为最小表示，仍是两个不同的取舍。

## 调查结果与边界

### 已确认机制

1. `legacy-state.ts` 的 `receipt` 将恢复目录绝对路径写入回执；`legacy-cleanup.ts` 完成清理时仅将状态改成 `complete`，仍保留旧 `backup`。
2. `installed-evidence.ts` 基于保留的 manifest、ZIP、回执成员与当前字节核验安装，不要求旧恢复目录与当前安装同级，因此完整搬迁副本仍能通过安装证明。
3. `native-plan.ts` 的 `assertNoPendingRecovery` 只解析 `backup`，没有区分回执状态；它在检查恢复目录是否存在之前调用 `validateRecoveryPath`。
4. `legacy-resume.ts` 的 `validateRecoveryPath` 要求恢复目录绝对路径规范化、与当前 skill 同父目录，且 basename 具有当前目录名对应的 `.native-` 前缀。搬迁破坏这些位置条件，即使旧目录已经清理也会先报错。
5. `cli.ts` 的原生分支在检查升级时进入计划，因此只读 `--check` 同样触发错误。旧恢复目录不存在且当前与远端版本相同时，代码先返回 `Status: current`，不会进入该校验；不能概括成每次检查都会失败。

因果链是“完整安装生成带绝对路径的回执 → 安装搬迁但回执保留历史路径 → 资产证明仍有效 → 新版本计划把已完成历史路径当作当前恢复约束 → 位置校验失败”。单变量对照排除了安装内容损坏和真实待清理目录作为本次合成复现的必要原因。

这是两个 skill 共用原生 updater 的搬迁兼容性缺陷，不是两个领域的记录业务逻辑问题，也不能仅归责为特定宿主项目的业务代码。用户现场描述与该机制相符，但未读取其真实回执、资产证明和日志，不能把合成复现当作现场完整验收。

### 方案选择与边界

局部路径修复和取消安装状态协议是不同的取舍；仅有搬迁 Bug 不足以证明后者。经新旧能力对照后，用户明确选择当前包覆盖模型：保留资产核验、确认、临时备份和普通失败处理，包外文件统一保留。当前契约归 [Skill Updater](../../tools/skill-updater/README.md#原生记录-skill)，本报告不另设一套规则。

该选择退出旧版退役清理、跨次续清理和永久回执驱动的补缺，不将它们换名为新的安装账本。修前现场如需继续使用旧协议，不能未经核实把未完成事务标为完成；本轮新实现对包外回执与备份采用统一保留策略，不跟随旧路径进行修改或删除。

### 当前实现的独立 Linux 验收

主代理独立于实现子代理，使用已准备的真实 Linux x64 原生程序、合成 skill 包和全部模拟的 release HTTP 响应，执行随附 `accept-current-overlay.mjs`。在仓库根运行 `node docs/investigations/_resources/261109-native-updater-relocated-complete-receipt/accept-current-overlay.mjs`；前置是按项目入口准备 `.local/record-cli`。该目录的构建来源证明是仓库运行时职责，不属于已安装 skill 的永久回执。

两个 role 均实际通过：

| 验收条件 | 实际观察 |
| --- | --- |
| 新装与搬迁后升级 | 真实程序通过版本及 help 验证，搬迁后完成合成 skill 版本 200 → 201。 |
| 包外文件 | 非 JSON 旧回执、旧 evidence 目录中的自定义文件及用户 sentinel 均原样保留；新装不生成安装回执或证据副本。 |
| 只读检查 | 仅请求 release 与 manifest；文件字节及 mode 快照不变。版本一致但二进制被损坏时仍按版本检查返回成功，不冒充文件健康检查。 |
| 同版本显式重装 | 独立安装入口恢复真实二进制，内容摘要与源一致，Linux mode 为 `0755`。 |
| 最终路径验证失败 | 故意使新 updater help 失败后，原有文件字节和 mode 全部恢复，本次 staging 已清理。 |
| 拒绝确认 | 返回未安装，目标目录没有创建。 |

主线程另在隔离目录检查了嵌套不存在目标：`planOverlay` 零写入，`applyOverlay` 创建所需父目录；校验失败后本次新增的空目录全部退出，符号链接祖先被拒绝。原生 CLI 的对应 check、拒绝确认及确认安装接线由新增回归测试承接。

上述证据证明当前安装引擎的代表性真实 Linux 路径；更新器说明为最小 fixture，未把它说成完整正式包或线上发布验收。

### 首轮实现检查点

- 主要实现由 GPT-6.1 Terra 子代理完成：以 `SKILL.md` 判断版本，共用临时覆盖与恢复，拆开 manifest/ZIP 获取，退出安装状态协议；两个 skill 的分发副本、版本、安装说明与 CI 接线已同步。采用既有[版本化覆盖判断](../decisions/use-versioned-overlay-skill-updates.md)，未新增重复长期决策。
- 文档按当前安装与更新主线收敛，领域维护规则保持原有 owner。代表性阅读核对能从当前说明恢复三个结果：业务调用所需运行时、`--check` 只证明版本、同版本修复使用显式安装入口。机械检查不作为额外 AI 用户实测。
- 首轮运行 `bun run test:skill-updater`：43 项通过；`bun run test:record-native-runtime`：23 项通过；`bun run check:test-evidence-catalog`：1389 个实体检查通过。该检查点随后进入提交前质量复审，不能将测试已通过当作全部设计责任已证明。
- `bun run check` 公共 quick 6 项通过；`skill-updater`、`skill-release-publisher`、`generated-file`、`skill-package-hash`、`test-evidence-project` 五个 scope 合并运行 19 项通过。该范围不是全仓、完整发布或实际 Windows 平台验收。
- 实施计划记录范围与本地验收，完成态按 Change 流程保存后结项；Git 提交、hook 推送与线上发布分别以各自实际结果为准，不由本报告代替证明。

### 提交前质量复审

本轮另由三个独立只读代理分别按 AI-Ready Docs、Test Design 与完整编码规范审查，整改由原实现代理和主代理在互斥范围完成，再交原审查者定向复核。邻近代码和 lint 通过均未被用作规范豁免。

| 切面 | 确认问题与实际整改 | 复核依据 |
| --- | --- | --- |
| 文档 | 发布和离线交付摘要仍指向旧安装/清理协议；两 skill 的相对命令缺 cwd。已回归当前 owner，并明确引导包目录、自更新目录和业务绝对路径；调查对照明确标为修前基线。 | 三类代表性阅读任务恢复正确，77 个本地链接目标存在；发布来源与发布恢复资产保留。 |
| 代码 | 恢复 rename 会消费唯一备份，清理错误会遮蔽主失败，已验证 manifest 又退回 unknown。已保留原备份、分别报告失败阶段，并以只读领域对象传递已解析 release。 | 独立隔离实验验证普通 EIO 读回失败仍保有原备份、主失败与清理失败同时可见、成功后清理失败明确已安装、目录清理错误有路径；falsy throw 也全部失败并恢复。 |
| 测试 | 原恢复节点未覆盖既有文件；CLI 独立意图混合，故障注入依赖私有命名，Case 有过度主张。已拆分最小节点、补真实字节/mode 恢复及最低成本失败证据，按实际路径/字节注入并校准 Case。 | 本轮 25 个保留节点均通过有效性、保护价值和形态/开销准入，10 个旧节点退出有据；替身先恢复、平台条件显式。普通未改测试不包含在该审查结论中。 |

整改后 `bun run test:skill-updater` 54 项通过，账本检查 1400 个实体通过；原生交付链 23 项通过。定向复核重跑的 16 个测试节点均无失败或跳过。主线程合并运行 updater、发布器、生成、包 hash、测试证据、调查集合与仓库材料七个 scope：21 项通过，覆盖完整 TypeScript program 的类型、lint、格式及所选代码指标；其余 42 项未选中。真实 Linux 二进制验收在整改后再次通过。完整 Windows、线上发布和用户现场安装仍在本报告的未证明范围之外。

### 尚未证明的范围

- 本轮未更新或修复用户项目里的安装副本。初始 48 项测试记录属于修前基线，首轮 43 项属于实现检查点；提交前测试与审查结论见质量复审，不按数量推断覆盖质量。
- 未在 Windows 运行；未验证完整业务记录操作、线上 release 或远端 bootstrap 包生效。当前真实二进制启动、版本与 help 验证不替代这些职责。
- 未对原用户现场的旧恢复目录与备份作盘点或清理；跨平台搬迁和非合作进程竞争未作为本轮证明目标。模拟网络实验也不证明网络认证或远端发布状态。

## 随附资源

- [当前覆盖模型的独立 Linux 验收](./_resources/261109-native-updater-relocated-complete-receipt/accept-current-overlay.mjs)
- [形成时离线复现脚本](./_resources/261109-native-updater-relocated-complete-receipt/reproduce.sh)
