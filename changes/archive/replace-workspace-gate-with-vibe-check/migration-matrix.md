# Migration Matrix

本文件是本 Change 的 Plan 阶段就绪与实施证据，负责固定旧门禁责任、最终选择、测试处置、Vibe 0.0.1 API、外部指标工具和切换条件。`proposal.md` 定义目标，`design.md` 定义实现约束，`tasks.md` 定义执行顺序；实施者使用本文件恢复逐项迁移结论，不再重新决定已经审计完成的边界。

表格中的处置和选择均已闭合。实施发现事实不符时，必须先更新本文件及受影响的设计与任务，再继续编码；不能在代码中静默采用另一套门禁范围。

**时间与计数边界：**本矩阵中的 `quick`、`--verbose`、旧 task object 和“31 项/31 行”都是迁移前编排的形成时证据，不是当前 CLI 或本 Change 的任务进度。“31”计数的是被盘点的旧 package-script 能力；`tasks.md` 的 33 个 checkbox 才是本 Change 的 Plan 进度，且已全部完成。归档后，本矩阵仅解释本次处置与证据；当前门禁用途和规则以 `docs/tooling.md` 为准。

## Final Gate Contract

### 调用与选择

| 调用 | 实例化的检查 | 成功含义 |
| --- | --- | --- |
| `bun run check` | 六项 Vibe 原生检查，以及下表标记为 `D+F` 的 25 项项目能力；不实例化 `pack:skills` | 日常必需检查形成可信结果；不代表可发布，也不产生包 |
| `bun run check --full` | default 全集、下表标记为 `F` 的 6 项项目能力，以及依赖全部 release-required check 的 `pack:skills` | 全部发布必需检查通过且本次打包成功 |

`@zxyycom/vibe-check@0.0.1` 的 `RunControls` 没有运行时选择器，因此 CLI 必须从同一份只读能力目录构造两份 Definition；不能先实例化 full 再让 default 从 aggregate 中排除检查。Definition 使用 `scheduler.maxParallel: 4`；现有项目 checks 没有共享写资源，除 `pack:skills` 的直接依赖外不声明 mutex。CLI 只接受无参数或单独的 `--full`；未知参数在任何 check 启动前退出 `1`，不保留 `--verbose` 或 `CHECK_CONCURRENCY`。

两种 Definition 都启用 Vibe progress，关闭 machine publication 和 diagnostic logging。两种调用都使用以下 aggregate：

```text
checks: all
mode: all
unavailable: fail
notApplicable: fail
empty: failed
```

只有 `RunResult.kind === "completed"` 且 `aggregate === "passed"` 时进程退出 `0`；configuration、planning、execution、output、cancelled、failed、unavailable 或 not-applicable 都退出 `1`。独立 check 不因另一项失败而停止；依赖只约束需要读取上游结果的 check。

项目 package script 通过一个共享 adapter 进入 Vibe。Adapter 以参数数组启动 `bun run <script>`，退出 `0` 结算为带 final data 的 `passed`，非零退出结算为带 final data 的 `failed`，命令无法启动、取消或无法形成可信结果结算为 `unavailable`。它只提供受控命令、退出类别和恢复动作，不实现额外的调度、aggregate 或 renderer。

### 证据 ID

以下 ID 是实施后 Test Evidence 的目标身份；迁移表用它们避免以自然语言测试名称充当验收条件：

| Evidence ID | 必须证明的公开责任 |
| --- | --- |
| `GATE-DEFINITION-CATALOG-001` | 能力目录完整、check ID 唯一，default/full 恰好实例化本文件声明的集合 |
| `GATE-SCRIPT-ADAPTER-001` | package script 的 passed/failed/unavailable 映射、参数数组调用和独立检查继续执行 |
| `GATE-CLI-RESULT-001` | 默认与 `--full` 解析、未知参数在执行前失败、RunResult 与退出码映射 |
| `GATE-VIBE-NATIVE-001` | 四项 blocking Vibe check 的 pass/finding/unavailable 结算 |
| `GATE-METRICS-ADVISORY-001` | 两项指标 check 的 finding 永久非阻断、无 waiver、工具不可用时 fail closed |
| `GATE-LIZARD-VERSION-001` | 函数指标只接受精确 Lizard 1.23.0；失配时不扫描、不打包且 full fail closed |
| `GATE-FULL-PACKAGING-001` | default 无打包节点；full 前置全 passed 后只打包一次，其他终态零调用、零本次制品写入 |
| `GATE-FILE-SELECTION-001` | 当前维护范围与历史内容排除规则同时作用于六项 Vibe check |
| `GATE-JSCPD-CONFIG-001` | Vibe 0.0.1 jscpd 兼容 wrapper 只接受 availability probe 或显式 config 扫描；缺 config 时 fail closed |
| `GATE-SCRIPT-CANCELLATION-001` | package-script adapter 收到取消后等待已启动子进程关闭，再结算 unavailable |

## Existing Task Disposition

选择列中 `D+F` 表示 default 与 full 都实例化，`F` 表示只由 full 实例化。所有 `retain` 行继续调用现有 package script；它们共同由 `GATE-DEFINITION-CATALOG-001` 和 `GATE-SCRIPT-ADAPTER-001` 验证，且仍以该 script 自身的测试或检查结果验证领域行为。`replace` 只替换旧门禁自身的测试实现，不删除其公开责任。

| 旧任务 | 能力与内容 owner | 失败风险或消费者 | 处置 | 最终 check / 选择 | 验证证据 |
| --- | --- | --- | --- | --- | --- |
| `test:decision-records-cli` | Decision Records CLI 行为；`tools/decision-records/tests/` | 决策记录命令回归会破坏长期决策维护 | retain | `script:test:decision-records-cli` / F | adapter 证据 + 原命令 |
| `test:relation-graph` | 共享关系图；`tools/shared/` | 多个领域工具可能产生错误关系或循环判断 | retain | `script:test:relation-graph` / D+F | adapter 证据 + 原命令 |
| `test:version-control` | 共享 Git 读取边界；`tools/shared/` | Change、调查和发布工具可能误判仓库状态 | retain | `script:test:version-control` / F | adapter 证据 + 原命令 |
| `test:skill-package-hash` | Skill 包 hash；`scripts/lib/skill-package-hash*` | 发布变更检测与不可变快照身份失真 | retain | `script:test:skill-package-hash` / F | adapter 证据 + 原命令 |
| `test:investigation-report-check` | Investigation Report CLI；`tools/investigation-report/tests/` | 调查报告校验行为回归 | retain | `script:test:investigation-report-check` / F | adapter 证据 + 原命令 |
| `test:test-evidence-cli` | Test Evidence CLI；`tools/test-evidence/tests/` | 测试证据目录与索引维护行为回归 | retain | `script:test:test-evidence-cli` / F | adapter 证据 + 原命令 |
| `test:task-graph-cli` | Task Graph Bun/Node 原生入口；`tools/task-graph/tests/` | 任务关系、租约或双运行时契约回归 | retain | `script:test:task-graph-cli` / F | adapter 证据 + 原命令 |
| `test:change-plan-cli` | Change Plan CLI；`tools/change-plan/tests/` | Change 生命周期和机械门禁回归 | retain | `script:test:change-plan-cli` / D+F | adapter 证据 + 原命令 |
| `test:skill-release-publisher` | Skill 发布器；`scripts/publish-skills*` | 发布选择、版本或上传准备行为回归 | retain | `script:test:skill-release-publisher` / D+F | adapter 证据 + 原命令 |
| `test:index-runtime` | 派生索引运行时；`tools/index-runtime/tests/` | 各领域派生索引读取或写入不一致 | retain | `script:test:index-runtime` / D+F | adapter 证据 + 原命令 |
| `test:skill-validator` | Skill Validator 行为；`tools/skill-validator/tests/` | Skill 结构或版本规则回归 | retain | `script:test:skill-validator` / D+F | adapter 证据 + 原命令 |
| `check:investigations` | 当前调查报告集合；`docs/investigations/` 与 Investigation Report CLI | 无效 active 调查进入仓库 | retain | `script:check:investigations` / D+F | adapter 证据 + 原命令 |
| `check:decisions` | 当前 Decision Records 集合；`docs/decisions/` 与 Decision Records CLI | 决策记录或派生索引失配 | retain | `script:check:decisions` / D+F | adapter 证据 + 原命令 |
| `validate` | Skill、链接、package/project 配置和版本综合校验；`scripts/validate.ts` | 仓库级结构或配置错误未被发现；Vibe 链接检查只覆盖其中一部分 | retain | `script:validate` / D+F | adapter 证据 + 原命令 |
| `test:skill-updater` | Skill Updater 行为；`tools/skill-updater/tests/` | 自更新、来源或安装边界回归 | retain | `script:test:skill-updater` / D+F | adapter 证据 + 原命令 |
| `check:test-evidence-cli` | Test Evidence 分发产物一致性；`tools/test-evidence/`、`scripts/build/test-evidence.ts` | 可分发 CLI 偏离源码 | retain | `script:check:test-evidence-cli` / D+F | adapter 证据 + 原命令 |
| `check:test-evidence-catalog` | Test Evidence case 与索引；`docs/test-evidence/` | 测试入口与证据账本失配 | retain | `script:check:test-evidence-catalog` / D+F | adapter 证据 + 原命令 |
| `check:skill-validator` | Skill Validator 分发产物一致性；`tools/skill-validator/` | 可分发 validator 偏离源码 | retain | `script:check:skill-validator` / D+F | adapter 证据 + 原命令 |
| `check:investigation-report-check` | Investigation Report 分发产物一致性；`tools/investigation-report/` | 可分发 checker 偏离源码 | retain | `script:check:investigation-report-check` / D+F | adapter 证据 + 原命令 |
| `check:change-plan-cli` | Change Plan 分发产物一致性；`tools/change-plan/` | 可分发 CLI 偏离源码 | retain | `script:check:change-plan-cli` / D+F | adapter 证据 + 原命令 |
| `check:decision-records-cli` | Decision Records 分发产物一致性；`tools/decision-records/` | 可分发 CLI 偏离源码 | retain | `script:check:decision-records-cli` / D+F | adapter 证据 + 原命令 |
| `check:task-graph-index` | 当前 Task Graph 派生索引；`docs/task-graph/` | 任务关系索引不可恢复或过期 | retain | `script:check:task-graph-index` / D+F | adapter 证据 + 原命令 |
| `check:task-graph-cli` | Task Graph 分发产物一致性；`tools/task-graph/` | 可分发 CLI 偏离源码 | retain | `script:check:task-graph-cli` / D+F | adapter 证据 + 原命令 |
| `typecheck` | TypeScript 静态类型；`tsconfig.json` 与 TS 源码 owners | 无效类型关系进入主分支 | retain | `script:typecheck` / D+F | adapter 证据 + 原命令 |
| `lint` | Oxlint/项目 lint 规则；`scripts/lint.ts` | 违反编码规则或可疑代码进入主分支 | retain | `script:lint` / D+F | adapter 证据 + 原命令 |
| `format:check` | Oxfmt 格式契约；项目源码 owners | 受管代码格式漂移 | retain | `script:format:check` / D+F | adapter 证据 + 原命令 |
| `check:skill-updaters` | Skill Updater 分发产物一致性；`tools/skill-updater/` | 可分发 updater 偏离源码 | retain | `script:check:skill-updaters` / D+F | adapter 证据 + 原命令 |
| `test:check` | 权威门禁公开行为；最终 Vibe 门禁测试模块 | 默认/full、失败聚合和打包边界失去回归证据 | replace | `script:test:check` / D+F；命令改为新 Vibe 门禁测试 | 十项 `GATE-*` 证据（包含两个兼容 wrapper 回归） |
| `test:environment` | 环境与项目配置；`scripts/environment*`、`scripts/validators/project-config*` | 工具版本或唯一入口要求未被诊断 | retain | `script:test:environment` / D+F | adapter 证据 + 更新后的原命令 |
| `test:generated-file` | 共享生成文件边界；`scripts/lib/generated-file*` | 生成写入/check 模式回归 | retain | `script:test:generated-file` / D+F | adapter 证据 + 原命令 |
| `hash:skills` | 当前 Skill 内容 hash；`scripts/hash-skills.ts` | CI 发布变化判定使用错误身份 | retain | `script:hash:skills` / D+F | adapter 证据 + 原命令 |

本表保留全部 31 项现有能力，但不保留旧编排器、旧 task object、旧顺序、旧并发参数、旧 renderer 或 default 打包。差异发生在实现与公开调用契约，不以减少 package script 数量证明替换价值。

## Vibe-native Checks

六项 Vibe check 在 default/full 中都实例化，并使用同一维护范围：`scripts/**/*.{js,ts}` 与 `tools/**/*.{js,ts}` 用于代码类检查；JSON、Schema 和 Markdown 使用 Git worktree 文件选择；共同排除 package 默认排除项、`changes/archive/**` 和 `docs/investigations/_resources/**`。重复检测关闭 cache，并只阻断不少于 150 tokens 的重复片段；Schema 只使用配置权威的两个本地 binding，不允许远程 schema，指标不配置 waiver。Vibe 0.0.1 会把 jscpd config 写在项目根外、而 jscpd 从 config 目录解析相对 `path`，所以 `scripts/lib/vibe-jscpd.js` 只将 Vibe config 的相对文件项改为按项目 cwd 解析的绝对路径；缺少 config 的扫描在转交前失败，不回退默认范围。Vibe 原生 SCC availability 已精确验证 `scc version 3.7.0`；Vibe 0.0.1 的 Lizard availability 只要求非空版本输出，因此 `function-metrics` 使用 `scripts/lib/vibe-lizard.js`：wrapper 只在 PATH `lizard --version` 精确为 `1.23.0` 时通过 availability，并把扫描参数原样转发给 PATH `lizard`。两个 wrapper 都不复制 Vibe 的文件选择、parser、aggregate 或调度。

| Check ID | 责任 | Finding 结算 | 无可信结果 | 选择 / 证据 |
| --- | --- | --- | --- | --- |
| `duplicate-detection` | 维护代码重复 | blocking，产生 finding 即 failed | unavailable，aggregate failed | D+F / `GATE-VIBE-NATIVE-001` |
| `json-validation` | 受管 JSON 语法和输入边界 | blocking | unavailable，aggregate failed | D+F / `GATE-VIBE-NATIVE-001` |
| `json-schema-validation` | Task Graph 与 Test Evidence 实例匹配各自 schema | blocking | unavailable，aggregate failed | D+F / `GATE-VIBE-NATIVE-001` |
| `markdown-link-validation` | 受管 Markdown 本地链接与锚点 | blocking | unavailable，aggregate failed | D+F / `GATE-VIBE-NATIVE-001` |
| `file-metrics` | SCC 文件代码行指标 | 永久 non-blocking；finding 保持 passed + warning | unavailable 或意外 N/A，aggregate failed | D+F / `GATE-METRICS-ADVISORY-001` |
| `function-metrics` | Lizard 函数行数、复杂度和参数指标 | 永久 non-blocking；finding 保持 passed + warning | unavailable 或意外 N/A，aggregate failed | D+F / `GATE-METRICS-ADVISORY-001`、`GATE-LIZARD-VERSION-001` |

指标审计已在当前维护范围完成真实 SCC/Lizard 扫描并得到可信的 non-blocking finding；finding 数会随维护代码变化，不作为门禁契约。扫描没有 input rejection、blocking finding 或已有 waiver。结论是本 Change 明确配置 `fileMetrics.findingWaivers: []`，并且不建立其他 waiver：文件指标在 non-blocking policy 下添加 waiver 不改变门禁结果，只会增加对账记录；Vibe 0.0.1 的函数指标没有 waiver 配置。实际 finding 继续作为可见测量，不需要豁免才能接入。

## Gate Test Evidence Disposition

原 `scripts/check.test.ts` 的 14 个最小原生测试入口按公开责任迁移或随旧实现退役。实施必须同步修改对应 `docs/test-evidence/repository-tooling/*.md`，然后同步统一派生索引；不能保留指向已删除测试节点的 case。`GATE-JSCPD-CONFIG-001` 与 `GATE-SCRIPT-CANCELLATION-001` 是为 Vibe 兼容边界新增的回归，而不是对某个旧测试节点的机械迁移。

| 现有 Case ID | 处置 | 最终证据 | 理由 |
| --- | --- | --- | --- |
| `PROJECT-MARKDOWN-SCOPE-001` | migrate | `GATE-FILE-SELECTION-001` | 历史内容排除仍是六项 Vibe check 的公开输入边界 |
| `CHECK-PLAN-SCRIPTS-001` | migrate | `GATE-DEFINITION-CATALOG-001` | 从旧最低档位数组改为最终能力目录和 Definition 选择 |
| `CHECK-OPTIONS-MODES-001` | retire | 无 | 动态并发解析属于删除的旧编排契约；Vibe 使用静态 `maxParallel: 4` |
| `CHECK-MODE-OPTIONS-001` | migrate | `GATE-CLI-RESULT-001` | 只保留 default/`--full`；删除 verbose 语义 |
| `CHECK-DURATION-FORMAT-001` | retire | 无 | 自定义耗时 formatter 被 Vibe progress 替代 |
| `CHECK-RESULT-FORMAT-001` | retire | 无 | 旧单项 renderer 与 verbose 展开不是目标契约 |
| `CHECK-SUMMARY-FORMAT-001` | retire | 无 | 旧摘要计数 renderer 被 Vibe aggregate/progress 替代 |
| `CHECK-FAILURE-CONTINUE-001` | migrate | `GATE-SCRIPT-ADAPTER-001` | 独立检查继续结算仍是公开失败行为 |
| `CHECK-QUICK-PROFILE-001` | migrate | `GATE-DEFINITION-CATALOG-001`、`GATE-FULL-PACKAGING-001` | 改为 default 集合且 default 完全不存在打包节点 |
| `CHECK-FULL-PROFILE-001` | migrate | `GATE-DEFINITION-CATALOG-001`、`GATE-FULL-PACKAGING-001` | 改为 full release-required 集合和终结打包 |
| `CHECK-WORKFLOW-PACKAGING-001` | migrate | `GATE-FULL-PACKAGING-001` | 任一前置非 passed 时零打包副作用仍是公开责任 |
| `CHECK-WORKFLOW-PACKAGE-FAILURE-001` | migrate | `GATE-FULL-PACKAGING-001` | 打包自身失败仍决定 full 失败 |
| `CHECK-CLI-CONCURRENCY-001` | retire | 无 | `CHECK_CONCURRENCY` 不再是 CLI 契约 |
| `CHECK-CLI-UNKNOWN-OPTION-001` | migrate | `GATE-CLI-RESULT-001` | 未声明参数仍必须在执行前拒绝 |

## Vibe 0.0.1 API Audit

审计只依赖锁文件中的 `@zxyycom/vibe-check@0.0.1` package root public API；不从 package subpath 导入。

1. `defineConfig` 接收 checks、outputs 和静态 scheduler；`RunControls` 只提供 aggregation、output override、flags、project root 和 signal，没有 check selection。因此 default/full 由同一目录分别构造 Definition。
2. `defineCheck` 支持直接 `dependsOn`、`maxParallel` 和 `mutex`。`passed`/`failed` 必须带 object-shaped final `data`；`unavailable` 必须带 reason，`not-applicable` 不带 final data。
3. `dependencies.get(id)` 对 direct dependency 的 passed/failed 返回 `ok: true`、status 和 data；对 unavailable/not-applicable 返回 `ok: false / upstream-data-unavailable`。实际行为探针还证明 dependent 会在 upstream failed 后执行并读到 `status: failed`，因此 `pack:skills` 能显式拒绝副作用而不是依赖调度器隐式跳过。
4. Aggregate 支持本 Change 要求的 all/fail/fail/failed 组合。`kind: completed` 不代表通过，CLI 必须继续读取 `aggregate`；有已结算 facts 的 output failure 仍然是 invocation failure。
5. progress、machine publication 和 diagnostic logging 可分别开关；本 Change 只启用 progress。默认 scheduler 为 4，本 Change显式写入 4 并对配置建立契约测试。
6. 文件指标默认支持精确路径 waiver，但 waiver 不删除 finding；函数指标 0.0.1 没有 waiver API。Vibe 原生 SCC availability 精确比较版本；函数指标公开 scanner executable 配置允许项目提供窄 wrapper，因为其原生 Lizard availability 只接受非空版本输出。两项指标都能把外部命令缺失、执行失败或结果无效结算为 unavailable，wrapper 另外把 Lizard 版本失配结算为 unavailable。

API 行为探针构造 passed、failed、unavailable 及三个 direct-dependent check，并使用本 Change 的 aggregate 规则运行。探针结果为 completed/failed；dependent 能读取 passed 与 failed final data，而 unavailable dependency 产生 `upstream-data-unavailable`。这些事实足以实施最小 adapter 和 full-only 打包依赖，不需要第二套状态机。

## SCC and Lizard Environment Audit

当前工作区已直接验证 `scc 3.7.0` 与 `lizard 1.23.0`：SCC 二进制的 Go build metadata 指向 `github.com/boyter/scc/v3@v3.7.0`，Lizard 由 uv tool 提供。门禁试运行已让两项工具完成真实扫描，因此本地状态是“已安装并可复用”，不是安装缺口。

目标环境的 owner 固定如下：

| 环境 | Owner 与实施结果 |
| --- | --- |
| 当前及新本地工作区 | `scripts/environment.js` 把 `scc` exact 3.7.0 与 `lizard` exact 1.23.0 纳入全局 prerequisite 探测，和 CodeGraph 一样只检查、不在 setup 内联网安装。已满足版本时直接复用；缺失或不匹配时输出工具、期望版本及文档恢复命令。`scripts/environment.test.ts` 覆盖 ready、missing、mismatch 和 probe failure。 |
| 本地安装说明 | `docs/tooling.md` 给出已验证的 `go install github.com/boyter/scc/v3@v3.7.0` 与 `uv tool install lizard==1.23.0` 路径，同时允许能产生相同命令与输出契约的现有工具管理器。仓库不为本 Change 新增第二个工具管理配置。 |
| 现有 CI package job | `.github/workflows/package-skills.yml` 在同一 job 内用 `actions/setup-go@v5` 提供 Go 1.26.5、用 `actions/setup-python@v5` 提供 Python 3.13，分别执行 `go install github.com/boyter/scc/v3@v3.7.0` 与 `python -m pip install lizard==1.23.0`，确保两个安装目录进入 PATH，随后显式运行两项 `--version` probe，再执行现有 `bun run check --full`。不新增 job 或第二完成信号。 |
| 门禁 invocation | `fileMetrics` 直接探测和执行 PATH 上已授权的 SCC，Vibe 原生 availability 精确检查版本；`functionMetrics` 先调用 `scripts/lib/vibe-lizard.js`，该 wrapper 精确探测 PATH `lizard` 并原样转发扫描参数。两者都不下载、不安装，也不把缺失或版本失配解释为零 finding。 |

这项 owner 分工同时满足当前环境不重复安装、新工作区有可行动恢复路径、CI 可复现以及 full fail closed。实施无需再选择 SCC/Lizard 由谁提供。

## Decision Record Disposition

实施建立 `use-vibe-check-as-authoritative-project-gate` 项目级 Decision Record，并通过一次 `归并` 演进事务覆盖和归档以下五条 active/aligned 前序：

- `select-prerequisite-checks-by-profile`：保留 default/full 两种成本语义，改由共享能力目录构造两份 Vibe Definition。
- `settle-all-selected-checks-under-bounded-concurrency`：保留单项失败后其他独立检查继续结算，改为 Vibe 静态并发 4，删除动态覆盖和长任务领取策略。
- `render-check-step-results-concisely`：由 Vibe progress 取代旧 renderer、verbose 和自定义摘要。
- `derive-check-exit-status-from-step-results`：改由 RunResult kind 与 invocation aggregate 唯一派生退出状态。
- `run-packaging-after-prerequisite-checks`：保留全 passed 后恰好打包一次和失败时零副作用，收窄为 full-only；default 不再打包。

后继记录同时固定六项 Vibe 检查、指标 advisory 语义、原 CI job 和唯一 `bun run check` 入口。完成演进事务后同步 Decision Records 派生索引；不能让已被替换的并发、verbose 或 default 打包规则继续保持 active。

## Failure and Cutover Evidence Matrix

| 场景 | 必须观察到的结果 | Full 打包边界 | 目标证据 |
| --- | --- | --- | --- |
| default 全部通过，指标有 finding | completed/passed，指标 warning 可见 | Definition 中没有打包节点 | `GATE-DEFINITION-CATALOG-001`、`GATE-METRICS-ADVISORY-001`、`GATE-FULL-PACKAGING-001` |
| full 全部 release-required check 通过 | completed/passed | `pack:skills` 恰好调用一次并产生本次包 | `GATE-FULL-PACKAGING-001` |
| 任一项目 script 非零退出 | 对应 check failed，aggregate/进程失败；其他独立 check 继续结算 | 零调用、零本次包写入 | `GATE-SCRIPT-ADAPTER-001`、`GATE-FULL-PACKAGING-001` |
| 项目 script 无法启动或被取消 | 对应 check unavailable，aggregate/进程失败；取消等待已启动子进程关闭 | 零调用、零本次包写入 | `GATE-SCRIPT-ADAPTER-001`、`GATE-SCRIPT-CANCELLATION-001`、`GATE-FULL-PACKAGING-001` |
| 重复、JSON、Schema 或 Markdown finding | 对应 blocking check failed，aggregate/进程失败；jscpd 扫描缺 config 不可退回默认范围 | 零调用、零本次包写入 | `GATE-VIBE-NATIVE-001`、`GATE-JSCPD-CONFIG-001`、`GATE-FULL-PACKAGING-001` |
| 任意数量文件/函数指标 finding | 指标 check passed + warning，aggregate 由其他 required check 决定 | 其他前置通过时允许打包 | `GATE-METRICS-ADVISORY-001`、`GATE-FULL-PACKAGING-001` |
| SCC/Lizard 缺失、版本不匹配、执行或解析失败 | 指标 check unavailable，aggregate/进程失败并给出恢复动作 | 零调用、零本次包写入 | `GATE-METRICS-ADVISORY-001`、`GATE-LIZARD-VERSION-001`、`ENV-METRICS-PREREQUISITES-001`、`GATE-FULL-PACKAGING-001` |
| selected required check 意外 not-applicable | aggregate/进程失败；不能解释为无问题 | 零调用、零本次包写入 | `GATE-VIBE-NATIVE-001` 或 `GATE-METRICS-ADVISORY-001`、`GATE-FULL-PACKAGING-001` |
| 打包 command 非零或无法启动 | `pack:skills` failed/unavailable，aggregate/进程失败 | 只保留隔离测试目录内的失败证据，不声称制品完成 | `GATE-FULL-PACKAGING-001` |
| 未知 CLI 参数 | check 启动计数为零，进程退出 `1` 并给出用法 | 不存在打包节点 | `GATE-CLI-RESULT-001` |
| Vibe configuration/planning/execution/output failure 或 Run cancellation | CLI 按 kind 报告稳定类别并退出 `1` | 未满足 full 成功，不形成发布完成信号 | `GATE-CLI-RESULT-001`、`GATE-FULL-PACKAGING-001` |
| 空 Definition 或空 aggregate selection | aggregate failed，进程非零 | 不存在可执行打包 | `GATE-DEFINITION-CATALOG-001`、`GATE-CLI-RESULT-001` |

切换不要求自然日、连续成功次数或 revision 数量。以下证据在同一候选版本成立后即可让 `package.json#check` 指向 Vibe、保留原 CI job 的 `bun run check --full`，并删除旧编排和候选入口：

1. 31 行处置均已实现，六项 Vibe check 与 retained 项目能力都能从最终 Definition 追溯。
2. 上表失败夹具全部通过，default 不含打包，full 的调用次数和隔离输出证明 fail closed。
3. 14 个旧 Test Evidence case 已按本文件迁移或删除，新的最小原生测试入口及派生索引通过检查。
4. 当前环境和带固定 SCC/Lizard setup 的 CI 等价干净环境都通过 `bun run check --full`。
5. 全文检索证明旧 `scripts/check.ts`、`scripts/lib/check-plan.ts`、旧专属 API/测试和 `package.json#vibe-check` 已退出；只有 `bun run check` 能形成权威门禁结果。

## Readiness Audit Result

| Readiness task | 审计结论 |
| --- | --- |
| 0.1 | 31 个旧任务均有能力、owner、风险、处置、最终 check/选择和证据，没有空白项 |
| 0.2 | default/full、blocking/required advisory、release-required 和 full-only 打包边界已固定 |
| 0.3 | 14 个旧测试及 Test Evidence 已逐项确定 migrate/retire 与最终证据 ID |
| 0.4 | 锁定版本的 Definition、dependency、aggregate、RunResult、outputs、scheduler 和指标结算已从声明与行为探针验证 |
| 0.5 | default/full、项目失败、四项 blocking finding、指标 finding、工具 unavailable、N/A、打包和 invocation failure 均有目标夹具 |
| 0.6 | AI-Ready Docs 审阅确认主承诺、owner、选择、失败因果、恢复动作和完成边界可从 Change 文本直接恢复；没有实施前待决问题 |
