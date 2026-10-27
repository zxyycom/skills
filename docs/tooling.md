# 项目工具链

本文承接主仓库从环境准备到 skill 制品发布的项目级工具链：依赖与运行时分工、package scripts、`scripts/` 与 `tools/` 的边界、生成和校验、Git hook、CI 与 release。具体组件的内部契约由相邻源码目录承接，实现代码的通用质量规则由 [编码规范](coding-style.md) 承接。

## 读取策略

按任务选择章节，不必通读：

- 环境准备：读[环境自举](#环境自举)。
- 日常操作：读[核心命令](#核心命令)或[仓库维护短命令](#仓库维护短命令)。
- 新增 skill：读 [Skill 接入](#skill-接入)，确认项目集成与分发要求。
- 验收：先读[验证模型](validation-model.md)，再读[核心命令](#核心命令)及[权威 Vibe 门禁](#权威-vibe-门禁)的范围与预算。
- 源码与生成：读[源码与依赖边界](#源码与依赖边界)及[生成与分发](#生成与分发)中相关章节。
- 修改 Gate 实现或质量政策：按需深入[权威 Vibe 门禁](#权威-vibe-门禁)的运行边界与 [Check 接入](gate-check-authoring.md)。
- Hook 与远端交付：分别读 [Git hook](#git-hook) 和 [CI 与发布](#ci-与发布)。

## 内容边界

本文件负责：

1. 开发环境如何准备，以及 pnpm、Bun、Node.js 和 tsgo 分别承担什么责任。
2. 维护者应调用哪些稳定命令，以及 `test:*`、`sync:*`、`check:*` 的关系。
3. 主仓库自动化、可分发工具源码和 skill 包内产物如何单向衔接。
4. 本地检查、Git hook、CI、skill hash、独立版本、打包和 release 如何组成交付流程。

本文件不展开单个 skill 的行为、工具内部 API、决策与调查格式或通用编码规则。需要修改具体组件时，继续读取对应源码目录及其局部契约：

- [Index Runtime](../tools/index-runtime/README.md)
- [版本管理中间层](../tools/shared/version-control.md)
- [Skill Updater](../tools/skill-updater/README.md)
- [Video Understanding 工具维护](../tools/video-understanding/README.md)

## 工具分工

1. pnpm 负责安装依赖；固定版本来自 `package.json#packageManager`，锁文件是 `pnpm-lock.yaml`，CI 使用 `pnpm install --frozen-lockfile`。
2. Bun 负责 package scripts 调度、源码同步适配和仓库中其余 TypeScript 脚本运行；本地与 hook 复用 `PATH` 上可运行的 Bun，不设置版本号前置门槛。CI 使用 workflow 选定的版本；生成一致性与实际测试承担兼容性验收，工具链指纹继续记录实际版本。优先通过 `bun run <script>` 使用稳定入口。
3. Node.js 负责运行分发 TS 入口、`@zxyycom/vibe-check` 的 Gate 入口及其原生测试；最低兼容版本由 `package.json#engines.node` 定义，`bun run check`、`bun run check:changed` 与 `bun run test:check` 是稳定的人工作业入口。
4. tsgo 负责类型检查；`typecheck` 使用固定版本的 `@typescript/native-preview`，对应 release-age 例外记录在 `pnpm-workspace.yaml`。
5. 常见格式、协议、解析和压缩能力优先使用成熟依赖；项目领域规则才由本仓库直接实现。

## 环境自举

`scripts/environment.js` 是进入项目工具链前的跨平台独立入口，只使用 Node.js 标准库，不依赖 Bun、pnpm、项目包或 `bun run check`。`check` 明确表示完整只读诊断，`gate` 只读诊断权威 Gate 的基础工具前置，`setup` 明确表示会补齐工具、依赖和仓库本地配置。

只读检查环境：

```bash
node scripts/environment.js check
```

只读检查 Gate 基础工具前置：

```bash
node scripts/environment.js gate
```

补齐 Bun、pnpm、锁定依赖和仓库本地配置：

```bash
node scripts/environment.js setup
```

环境入口遵守以下边界：

1. Git、满足 `package.json#engines.node` 的 Node.js、全局 CodeGraph 和 SCC 4.0.0 是前置条件；入口只诊断和复用它们，不安装或升级它们。Bun 检查可运行性，pnpm 服从 manifest 中的精确版本。函数指标使用 Vibe 随包分析器。
2. `check` 检查 Git、Node.js、Bun、pnpm、CodeGraph、SCC、索引状态、直接依赖、Git hook 和中央 task-graph root，不下载或修改环境。
3. `gate` 只检查 Git、Node.js、可运行的 Bun、精确 pnpm 与精确 SCC，不要求 CodeGraph 索引、项目依赖、hook 或 task-graph root；Gate 中每次执行的 `gate-environment` Check 调用同一入口，失败时保留工具探测结果，并通过依赖阻止其他 Check 执行，避免把基础环境漂移扩散成生成物、测试或指标的伪失败。
4. `setup` 复用已有可运行的 Bun，只在不可用时通过 npm 安装 Bun；pnpm 按 manifest 固定版本安装或切换。随后运行 `pnpm install --frozen-lockfile`，调用已就绪的全局 CodeGraph 执行 `init` 和 `sync`，并配置当前 worktree；Git、Node.js、CodeGraph 或 SCC 缺失、版本不匹配或探测失败时会在任何安装前失败并给出恢复动作。
5. 恢复外部指标工具时，必须让精确 SCC 版本进入 `PATH`。mise 用户可运行 `mise use go:github.com/boyter/scc/v4@4.0.0` 选择已安装版本；其他环境可运行 `go install github.com/boyter/scc/v4@v4.0.0` 安装。仅存在 mise shim 而未选择版本时，`scc --version` 会以非零状态退出，环境入口会保留该诊断而不是误报为指标 finding。环境入口不替代类型检查、测试、生成漂移检查或完整仓库检查。

仓库本地配置由 `scripts/setup-repository.js` 承接：

1. 当前 worktree 的 `core.hooksPath` 会设为 `.githooks`；hook 本身以可执行 mode 进入版本管理，POSIX setup 另外恢复工作区执行位，Windows 使用其原生 Git hook 存在性语义。
2. 当前项目的默认 task root 每次从 Git worktree 结构发现为主 worktree，不额外持久化绝对路径；因此 linked worktree 与主 worktree 使用同一中央索引。
3. 每个新 clone 和 linked worktree 都运行标准环境 `setup`；这样 POSIX worktree 的文件权限会实际落地，所有平台的 `hooksPath` 也保持一致。

Codex 工作区在 `.codex/environments/` 提供两个入口：

1. `skills` 保留工作区内容并运行 `node scripts/environment.js setup`。
2. `clear` 先丢弃已跟踪改动和未跟踪文件，再运行同一 setup 入口；只在明确需要干净工作区时使用。

`.codex/config.toml` 通过全局 `codegraph serve --mcp` 启动代码图服务。`.codegraph/` 只提交维持忽略规则的 `.gitignore`，本机索引数据库不进入版本控制。

## Package scripts

`package.json#scripts` 是命令名称与实际入口的唯一清单。本节只解释稳定命令和命令族，不复制每个测试的内部覆盖项。

### 核心命令

| 命令 | 责任 |
| --- | --- |
| `bun run typecheck` | 使用根目录 `tsconfig.json` 对 `scripts/`、`tools/` 和声明源执行 `tsgo --noEmit` |
| `bun run lint` | 先按已安装版本的官方 Oxlint schema 和受校验的统一项目基线检查配置，拒绝配置级的路径、继承或规则绕过及基线降级，再使用 Oxlint 的 correctness、type-aware 和已确认插件规则检查 `scripts/` 与 `tools/`；TypeScript 编译诊断仍由 `typecheck` 的 tsgo 承接。未使用的 disable directive 作为 error；基线和唯一局部例外路径由[编码规范的 Oxlint 例外规则](coding-style.md#7-oxlint-例外保持局部且可审计)承接 |
| `bun run lint:fix` | 使用与 `lint` 相同的配置前置校验，对 `scripts/` 与 `tools/` 应用 Oxlint 安全修复；工具源码变化后必须按对应 `sync:*` 入口同步生成物，并按版本承载边界判断是否提升 skill 版本 |
| `bun run format` | 使用 Oxfmt 就地格式化 `scripts/` 的维护 TypeScript/JavaScript 与 `tools/` 的 TypeScript 源码（包括维护的 `.d.mts` 声明源）；不格式化 skill 内生成制品、项目文档 |
| `bun run format:check` | 只读检查 `format` 覆盖的全部维护源码；base 与 release 门禁均执行 |
| `bun run fix` | 依次运行覆盖 `scripts/` 与 `tools/` 的 `lint:fix` 与 `format`，用于安全地修复维护源码 |
| `bun run validate` | 校验全部 skill 的结构、frontmatter、正文、资源目录、版本和主仓库配置；不校验链接 |
| `bun run hash:skills` | 从 Git `pending` 快照临时计算 package hash，并校验内容变化的 skill 已相对 `--baseline-ref` 提升 `SKILL.md` 中的 `metadata.version` |
| `bun run pack:skills` | 从版本管理 `pending` 快照生成每个 skill 的 zip 和 release manifest |
| `bun run accept:video-windows -- --artifact <absolute-zip>` | Windows 视频验收组合入口：运行视频源码测试，再对显式 zip 进行仓库外独立安装和分发验收；不替代完整 Gate |
| `bun run publish:skills -- <rolling\|snapshot>` | 供发布 workflow 校验 `dist/` 制品并执行滚动发布或不可变快照事务；需要 GitHub Actions 提供的 `GH_TOKEN`、`GITHUB_SHA` 和 `PACKAGE_HASH` |
| `bun run setup-hooks` | 配置当前 worktree 的 `core.hooksPath`，并在 POSIX 文件系统恢复 hook 可执行权限 |
| `bun run setup-repository` | 配置当前 worktree hook，并确认当前项目的主 worktree 可作为默认 task-graph root |
| `bun run check [--diagnostic-log]` | 默认 quick：只承担下述十项必要 eligible 范围，强制快速性能预算；消费既有精确 receipt，不发布或清除 receipt。用于日常反馈，不代替完成验收。 |
| `bun run check:changed`（或 `bun run all`） | changed：对完整 base 范围执行变更相关验收，沿用精确 receipt、共享工具 flag、成功前置和成功发布事务；完成维护工作前使用。 |
| `bun run check --scope full` | 实际执行全部 66 项 base，不复用或发布 receipt；CI 的任意 base scope 均提升到 full。 |
| `bun run check --tag release [--baseline-ref <ref>] [--cold] [--diagnostic-log]` | 运行完整 69 项 release Gate，不采集、读取或发布项目 receipt；环境前置通过后实际执行普通检查，再完成版本授权与打包。省略基线时使用 `HEAD`，CI 使用事件基线；`--cold` 明确表达全执行意图。 |

`typecheck` 从根 `tsconfig.json` 的 include 开始检查，并沿 import 检查传递可达的 skill TS/MTS 与声明；涉及模块解析的 skill manifest 也属于输入。它证明当前 TypeScript program 类型有效，源码与生成物一致性由统一生成检查另证。type-aware `lint` 同样保守纳入该程序输入；`format` 保持自身独立范围。

根 `tsconfig.json` 启用编译器原生 incremental，build info 位于 `.log/vibe-check/cache/typecheck/tsconfig.tsbuildinfo`。命令仍为 `tsgo --noEmit`，每次调用都按当前完整 include 与质量选项结算诊断；编译事实可丢弃并重建，不作为项目成功 receipt 或缩小检查范围的依据。

### 权威 Vibe 门禁

`check`、`check:changed`、`all` 与 release 命令共用同一权威 Gate 实现；范围决定证明责任，quick 不替代完整变更验收。根开发依赖与锁文件固定 `@zxyycom/vibe-check@0.0.4`；`pnpm-workspace.yaml` 对该精确版本声明 release-age 例外。项目直接调用 Vibe `run`，运行责任如下：

验证职责、证明与复用条件见[验证模型](validation-model.md)；新增、修改或移除 Check 时读 [Gate Check 编写与接入](gate-check-authoring.md)。以下记录公开选择、质量政策与运行边界。

#### Catalog 与选择

每次 invocation 构造相同的 69 项 Definition：环境 1 项、原生材料 8 项、维护脚本 20 项、语义测试 37 项、release 交付 3 项。base 范围为前四类共 66 项；普通产品验证属于 base，只有 snapshot prepare、version authorization 和 packaging 由 `release` tag 独占。

`gate-environment` 无 flag、每轮执行，复用 `node scripts/environment.js gate` 检查 Git、Node、可运行的 Bun、精确 pnpm 与精确 SCC；其余所有 Check 都显式依赖它。该窄 action 的工具版本 owner 和恢复路径见[环境自举](#环境自举)。环境失败作为真实 failed outcome 保留 transcript，其他 Check 因前置未通过而不启动。

CLI 使用以下执行范围；所有范围保持同一完整 Definition，实际执行由原生条件、flags 与成功前置决定：

| 范围 | 证明责任与执行选择 |
| --- | --- |
| quick（默认） | eligible 固定为 `gate-environment`、`secret-detection`、`json-validation`、`json-schema-validation`、`markdown-link-validation`、`markdown-lint`、`script:typecheck`、`script:lint`、`script:format:check`、`script:validate`。这是可执行范围，精确 receipt 仍可省略其中适用项；不覆盖领域测试、生成漂移或完整质量材料。 |
| changed | 完整 base 的变更相关验收。环境与除 Markdown 内容外的七项原生材料每轮结算；57 项项目命令与 Markdown 内容共 58 项按完整输入证明、共享工具 flag 与成功前置选择。 |
| full / CI base | 全部 66 项 base 实际执行，不使用 receipt；CI 将显式 quick/changed 也提升到 full。 |
| release | 全部 69 项实际执行，不使用 receipt，再完成同快照版本授权与打包。 |

各 Check 以可独立验收的责任组织；精确命令由失败重跑提示和实际 catalog 提供。共享输入变化可能带入其他订阅者，成功前置也可能带入 provider；它们实际执行并结算，复用项不冒充本轮 passed。

CLI 只有 Run `completed`、严格有效 aggregate `passed`，且[适用性能政策](#性能报告与快速预算)通过才退出 0。有效集合中的 failed、unavailable 或意外 not-applicable 均阻断；rejection、取消、配置、planning、execution 或原生 output 失败在所有范围均退出 1。quick 不发布成功证明；changed 的发布前提见[项目输入与成功证明](#项目输入与成功证明)。

CLI 参数形状如下；未知、缺值或重复参数在启动 Check 前以 usage 拒绝：

- `--scope quick|changed|full`：默认 quick；与 release tag 或 `--full` 互斥。CI base 的有效 scope 为 full。
- `--tag release`：唯一公开 tag，每次最多一次。
- `--full`：`--tag release` 的兼容别名，不能与该 tag 同用；全 base 使用 `--scope full`。
- `--baseline-ref <ref>`：仅 release 可用。值须已 trim、非空，不以 `-` 开头且不含 NUL、CR、LF；默认 `HEAD`。CLI 校验形状，Git revision 由 release prepare 解析。
- `--cold`：仅 release 可用，每次最多一次；release 本身已全执行，用于显式声明冷运行。
- `--diagnostic-log`：每次最多一次，只开启本次 diagnostic channels。

#### 性能报告与快速预算

每轮报告总墙钟和本轮实际执行 Check 的耗时统计。quick 必须同时满足 total < 30s、P90 < 10s、mean < 5s；任一达到或超过阈值即失败。changed、full、CI 与 release 只报告，不设硬预算。

总墙钟使用单调时钟，从 `runVibeCheck` 入口、输入采集前开始，覆盖业务收尾（含 changed receipt 发布），在性能报告前采样。quick 初判通过时，在报告后末次采样；若此时达到总墙钟阈值，仅补写一次失败报告，不循环。末次采样后的打印、最终报告落盘和 return，以及函数前模块加载、父 Bun 启动均不计入；这不是强制超时终止承诺。

Check 样本只取原生本轮实际 execution/settlement 时长：null、未执行和 receipt 复用项不补零，实际 0 保留；nearest-rank P90 为升序样本第 `ceil(0.9*n)` 项。无样本或非法测量如实报告，并使 quick 失败。

性能政策补充 CLI 成功条件，不改写原生质量 aggregate。项目附加性能 summary 写入不可用时，quick 失败；其余范围明确 warning，不改变原生质量结论或 changed 的 receipt 成功事务。quick 不调用 receipt publisher，预算失败或报告后超限均不会新增通过证明。

#### 项目输入与成功证明

quick 和 changed 可以消费既有 receipt；只有 changed 可以发布，quick 保留已有文件不作写入，full/CI/release 不采集或复用。receipt 只证明某个纳入完整输入契约的 Check 在完整有效输入下曾通过，不按 branch、HEAD 或目录时间推断。项目承担的最小事务是“输入声明 → 内容与环境身份 → 精确 passed 记录 → 最终成功且无漂移发布”：

1. 可复用 Check 必须声明完整实际输入，包括源码、测试、生成物、配置及其传递依赖，并绑定相关工具链与环境；声明与修改方法见 [Check 编写契约](gate-check-authoring.md#项目输入证明)。采集还覆盖实际读取的 ignored 材料及目录身份。
2. 未知路径、未归属领域文件、symlink、不支持的文件类型、读取错误、采集超限或必要工具探测失败使证明不闭合：在当前有效范围保守执行，不发布部分证明；quick 不因此升级为完整 base。采集上限和回退诊断见[运行结果与诊断](gate-runtime.md#输入证明诊断)。领域归属检查不能代替 import 和动态读取的依赖审查。根依赖以受信 `pnpm install --frozen-lockfile` 为前提；包管理器外改写依赖后先修复安装。
3. 只有完整 Check 指纹及订阅能力指纹精确匹配的 passed 记录可复用。缺失、损坏或变化扩大执行；工具链、环境与契约版本变化也影响身份。敏感环境原值不写入证明。
4. 只有 changed 的最终 Run completed/passed，且本次所有实际执行项（包括共享输入和成功前置带入项）均 passed，才重新采集同一输入域；workspace 与工具链指纹无漂移后，原子发布本次通过和精确复用的证明。失败、取消、输出错误、输入未闭合、漂移、采集或写入失败均不发布；起止漂移只阻止发布，不额外改变本次 Gate 结算。cache 不可用只扩大执行，不改变质量结论。

性能 history 只影响调度偏好，原生计算缓存仍按当前材料与规则结算；二者均不是成功 receipt。执行与证明取舍见[原生执行与项目输入证明决策](decisions/separate-quick-gate-from-complete-validation.md)。

#### 调度与命令执行

Gate 最多并行 4 项，外部进程容量为 3、仓库扫描容量为 2；release CPU 容量为 4，版本管理测试独占全部 CPU 容量。资源从准入持有到结算，性能 history 不能越过硬约束。history 缺失或不可用不改变质量结论，无依赖 Check 即使已有其他失败仍独立结算；隔离的理由与复核条件见[独立资源边界决策](decisions/retain-release-version-control-isolation.md)。

每个命令 Check 从项目根以独立 argv 和继承环境运行，保留完整 transcript；环境命令超时 30s、stdout/stderr 各限 1 MiB，其余命令超时 120s、各限 16 MiB。非零退出失败，无法启动、超时、取消或捕获不完整按 unavailable 结算。失败提示给出重跑命令和 transcript 路径；原始输出不嵌入 machine data。

#### 运行产物与恢复

每次运行在 `.log/vibe-check/invocations/` 创建独立结果目录。失败时先按 CLI 提示从项目根重跑对应命令并查看 transcript；输入未闭合或采集失败时检查诊断并修复输入身份或声明。产物路径、计划与实际结果的区别及诊断字段见 [Gate 运行结果与诊断](gate-runtime.md)。

#### 原生材料范围与质量政策

八项原生 Check 的项目配置由 `checks/native.ts` 维护，使用完整 patterns 和原生默认排除。代码类检查读取磁盘中 `scripts/`、`tools/` 的 JavaScript/TypeScript；`docs/investigations/_resources/**` 作为非当前维护材料排除。JSON 与 Markdown 链接显式选择 JSON/Markdown 扩展名，并同时排除调查 `_candidate.*` 作者工作台；格式判断由对应原生 Check 完成。

| 检查 | 当前范围与结算 |
| --- | --- |
| 重复检测 | 维护代码；不少于 150 tokens 的重复片段形成 blocking finding。原生 fragments cache 位于 `.log/vibe-check/cache/duplicate-fragments/`，本次仍按当前配置结算。 |
| 密钥检测 | 维护文本型扩展名、Git 属性/忽略文件与 hooks；5,120 文件、单文件 1 MiB、64 MiB 总量上限，高置信 PEM private-key finding、coverage gap 或 unavailable 阻断。 |
| JSON / Schema | JSON 检查维护材料；Schema 显式选择 Task Graph/Test Evidence 的两项 schema 和两项 binding，以配置为 schema 身份，使用 offline registry/catalog。 |
| Markdown 链接 | 当前维护材料的直接 target、anchor、目录和 symlink 由本次验证承担；root-external 使用 report 边界。有限预算覆盖完整维护范围：单文件 1 MiB、10,000 个语义 occurrence、4,096 次直接端点逻辑校验（含 memo 命中，不是唯一 target 数）。parse-facts cache 位于 `.log/vibe-check/cache/markdown-parse-facts/`，命中仍重新验证目标并结算。 |
| Markdown 内容 | `**/*.[mM][dD]` 与 `**/*.[mM][aA][rR][kK][dD][oO][wW][nN]`，另排除调查资源、调查 `_candidate.*`、`skills/**/references/upstream/**` 和 `skills/**/reference-original.md`。blocking 六规则：`no-reversed-links`、`no-missing-space-atx`、`no-empty-links`、`no-alt-text`、`reference-links-images`、`table-column-count`；完整输入精确命中成功 receipt 时可省略；执行时可复用 `.log/vibe-check/cache/markdown-lint-facts/` 的逐文件计算事实，仍按完整当前范围和规则结算。链接/锚点由独立 Check 每轮验证。 |
| 文件/函数指标 | 全部使用 blocking policy。文件指标使用 PATH SCC 4.0.0，函数指标使用随包 TypeScript analyzer；finding 进入本次 `machine/records.ndjson`。 |

函数普通上限依次为 NLOC、CCN、nesting depth、参数数：产品源码 `45/10/5/5`，自动化脚本 `80/16/8/7`，测试 `100/20/10/8`。低复杂度 NLOC allowance 分别为 CCN 严格低于 `5/7/8` 时允许到 `120/220/250`。每条阻断信号都须验收前处置，仍按[编码规范](coding-style.md#6-保持局部可推理并按责任组织代码)复核真实责任，不以放宽阈值或批量 waiver 替代整改。finding 数量与耗时是测量，不是固定 catalog 边界。

#### 生成前置与发布快照

`script:check:skill-updaters` 是 Gate 中统一的生成一致性 provider；需要可信当前分发产物的语义 Check 依赖它通过。领域 `check:*` / `sync:*` 仍供人工定位和同步。typecheck/lint 检查当前程序质量而不证明生成一致性，也不增加 quick 的生成前置。provider 失败会阻止依赖的 consumer，按 artifact 路径或领域命令定位；源码专用测试按实际输入声明，不因工具名称推导前置。详见[统一生成前置决策](decisions/unify-gate-generated-artifact-prerequisite.md)。

普通检查的工作树输入与 release 制品输入分别核对：普通命令从项目根运行并依自身契约读取材料，原生材料检查在适用范围内从磁盘选择；release prepare 捕获一次 Git `pending` 快照，默认 Git 实现将其映射到 index。因此 release 通过不证明未暂存 skill 改动已进入制品。

release DAG 固定为环境前置通过后：

1. `release:skill-prepare` 解析基线 revision，一次捕获 pending snapshot、hash、版本和 version issues。捕获或解析失败为 unavailable；存在版本问题仍完成 prepare。
2. `release:skill-version` 依赖 prepare 与全部 66 项普通 Check，只有它们可信 passed 才授权；版本问题使 authorization failed。
3. `pack:skills` 依赖 authorization，从已授权的同一内存 snapshot 恰好打包一次，不重读 index。

同一快照限于本次 Run；公开 machine data 只保存 baseline、问题计数等摘要。`hash:skills` 仍为独立 CLI，pre-commit 仍独立按 `HEAD` 校验待提交版本。

#### Gate 实现入口

Gate 项目入口位于 `scripts/vibe-check.ts` 与 `scripts/lib/vibe-gate/`，环境入口为 `scripts/environment.js`；按任务从 [Check 接入](gate-check-authoring.md)和实际源码追踪具体 owner。Vibe 公共 API 以安装版本的随包文档和类型为准。

### 仓库维护短命令

“仓库维护短命令”指 `package.json#scripts` 中面向本仓库日常领域操作的稳定入口。它们统一使用 `bun run <command> -- <arguments>`，避免调用方重复 skill 安装路径，同时不建立第二套领域 CLI。

| 短命令 | 本仓库内用途 |
| --- | --- |
| `bun run novel-cards -- <arguments>` | 本地小说卡片检查、章节定位、版本与历史查询、索引同步及受控变迁维护；命令与运行边界由 [CLI 契约](../skills/novel-cards/references/local-cli.md) 承接 |
| `bun run lightweight-judgment -- <command> [参数]` | 单次结构化判断、本地前置诊断、离线预览与调用统计；外发、配置与结果按 [CLI 操作契约](../skills/lightweight-judgment/references/cli.md) |
| `bun run change-plan -- <arguments>` | 维护 change proposal、design、tasks 与生命周期 |
| `bun run decision-records -- <arguments>` | 查询和维护长期决策及其派生索引 |
| `bun run investigation-report -- <arguments>` | 检查、同步或查询调查报告索引 |
| `bun run task-graph -- <arguments>` | 默认操作当前项目中央 task graph，或显式切换目标项目 |
| `bun run test-evidence -- <arguments>` | 校验、同步和查询显式测试证据 case |
| `bun run validate-skill -- <skill-directory>` | 校验单个 skill 的可移植结构 |

项目内 agent、维护说明和日常人工操作使用上表入口。除 task-graph 外，每个入口直接委托对应 `skills/*/scripts/` 生成 CLI；参数、输出、退出状态和事务逻辑仍由该领域 CLI 定义。只有以下场景直接调用 `tools/` 源码或 `skills/*/scripts/` 完整路径：

1. 验证工具源码与生成制品的一致性。
2. 调试 package 入口或领域 CLI 实现。
3. 编写不依赖本仓库 `package.json` 的 skill 分发说明。

新增可分发 CLI 不会自动获得仓库维护短命令。只有该 CLI 已成为本仓库的日常维护入口时，才同时更新 `package.json`、本节清单和项目配置校验；命令级测试必须覆盖清单中的全部入口。

`package.json#scripts` 仍是实际执行命令的事实源。`scripts/validators/project-config.ts` 中的类型化映射只声明这些短命令必须委托的入口，并由项目校验核对两者一致；它不参与命令分派。

```bash
bun run change-plan -- list
bun run decision-records -- candidates
bun run investigation-report -- list
bun run task-graph -- task list
bun run test-evidence -- tags
bun run validate-skill -- skills/task-graph
```

task-graph 短命令另外承担项目 root 选择。省略 `--root` 时，它从当前 Git 仓库发现主 worktree，避免 linked worktree 静默形成第二份索引。提供唯一的 `--root <path>` 或 `--root=<path>` 时，相对路径以短命令所在 worktree 为基准解析，并切换到目标项目自己的 CLI 与 `docs/task-graph/task-graph-index.json`。缺值、重复 root、目标项目缺少 CLI 或索引时直接失败；短命令拒绝 `--index`。同一项目确需操作其他索引时，直接调用领域 CLI 并显式承担该选择。

### 工具维护命令

| 责任 | 行为测试 | 显式写入 | 只读检查 |
| --- | --- | --- | --- |
| Novel Cards | `test:novel-cards-cli` | `sync:novel-cards-cli` | `check:novel-cards-cli` |
| Video Understanding | `test:video-understanding-cli` | `sync:video-understanding-cli` | `check:video-understanding-cli` |
| Lightweight Judgment | `test:lightweight-judgment-cli` | `sync:lightweight-judgment-cli` | `check:lightweight-judgment-cli` |
| Change Plan | `test:change-plan-cli` | `sync:change-plan-cli` | `check:change-plan-cli` |
| Decision Records | `test:decision-records-cli` | `sync:decision-records-cli` | `check:decision-records-cli`、`check:decisions` |
| Skill Validator | `test:skill-validator` | `sync:skill-validator` | `check:skill-validator` |
| Investigation Report | `test:investigation-report-check` | `sync:investigation-report-check` | `check:investigation-report-check`、`check:investigations` |
| Task Graph | `test:task-graph-cli` | `sync:task-graph-cli` | `check:task-graph-cli`、`check:task-graph-index` |
| Test Evidence | `test:test-evidence-cli`、`test:test-evidence-project` | `sync:test-evidence-cli`、`sync:test-evidence-catalog` | `check:test-evidence-cli`、`check:test-evidence-catalog` |
| Skill Updater | `test:skill-updater` | `sync:skill-updaters` | `check:skill-updaters` |
| MCPShell Workspace Bridge | `test:mcpshell-workspace-bridge` | `sync:mcpshell-workspace-bridge` | `check:mcpshell-workspace-bridge` |
| 共享基础设施 | `test:check`、`test:environment`、`test:generated-file`、`test:index-runtime`、`test:relation-graph`、`test:skill-package-hash`、`test:version-control` | — | — |

Vibe 的原生 `markdown-link-validation` Check 是当前维护 Markdown 链接的唯一全仓 owner；它沿用 blocking、fail-closed 和文件选择，并排除 `docs/investigations/_resources/**`。该目录是 Investigation Report 保存的形成时字节，仍由资源引用与完整性门禁维护。根 `bun run validate` 校验全部 skill 的结构和主仓库配置，不扫描链接。只有显式 `bun run validate-skill -- <skill-directory>` 才校验所指单个 skill 的内部链接。

三类前缀表达不同义务：

1. `test:*` 证明源码或分发模块的行为。
2. `sync:*` 是显式写入口，只在维护对应生成源时运行，不由完整检查自动写回。
3. `check:*` 只读验证仓库内容或生成产物；生成工具的 `sync:*` 与 `check:*` 必须使用同一构建路径。

`test:index-runtime` 只聚合确定性功能测试。纯规模用例不能因为数据量大就进入 Gate，只有触发真实分页上限等不同功能路径，或声明并验证独立性能契约时才保留对应入口。

只有具备独立维护操作、完整检查消费者或生成写入责任的命令才保留为 package script。`scripts/validators/project-config.ts` 检查这些稳定入口仍存在于 `package.json`。

### 工具 CLI 与 Git fixture 测试边界

`test:<tool>` 是工具行为与分发边界的稳定重跑入口；需要完整变更验收时使用 `bun run check:changed`，需要 release 范围时使用 `bun run check --tag release`，不在维护说明中以测试文件路径替代这些 package scripts。

按待证明契约选择最小充分边界：规则矩阵使用领域/API，来源读取、文件系统身份、Git 历史/index/worktree 和恢复使用必要真实状态，命令接线使用 CLI，分发消费使用生成物。每个上层测试应说明降层后会丢失的不可替代观察；边界数量与执行成本分别报告，不以标签或数量代替证明。fixture-only、Git 与 CLI 支持按职责分离，顶层 import 也是实际输入；收窄 Gate 订阅前须核对完整加载闭包。

1. CLI 的参数组合、领域错误、文本/JSON 输出和退出结果在源码入口测试。入口可以接收局部 `argv`、工作目录和 stdout/stderr writer，但这些测试参数不建立新的公开 SDK。
2. 真实 Node smoke 聚焦分发边界：已安装/分发制品启动、真实 argv 解析、stdout/stderr 分流、退出状态和模块解析；参数矩阵由源码入口承接。同进程 CLI 测试与真实 Node 子进程分别报告。
3. 需要固定 Git 基线的测试在其测试 owner 下提交普通原始 fixture 文件树，而不是提交 `.git/`、bundle、可变工作区或绝对路径。启动 helper 复制该树到 case 私有目录，执行真实 `git init`、固定本地配置、`add` 和基线 `commit`；fixture 原始树是长期输入，helper 是唯一初始化路径。
4. 并行 case 不共享可变 Git 状态：只读查询可以复用只读模板；index、worktree、refs、config、lock 或恢复路径分别使用其隔离所需的私有状态。只有至少两个实际 consumer 共享同一初始化不变量时，才将最小 bootstrap helper 放入 `tools/shared/tests/`。

### 测试证据账本

本仓库使用固定的 `docs/test-evidence/` 根目录、其中的 `cases/` 单 Case 文件和固定派生索引维护测试账本。账本覆盖 `test:*` 稳定入口保留的全部最小原生测试入口；每个 Case 按同一测试意图承接一个或多个可独立选择、单独报告的最小原生测试节点。框架不限，本仓库当前沿用 `node:test` API 定义节点；普通测试通过 `bun test` 执行，task-graph 原生 lock 集成测试通过其声明支持的 Node.js `--test` 执行。测试文件、package script 和完整检查仍只是聚合容器。

Case 使用 Tests、可选 tags、Contract 与 Proves，由测试改动显式维护。工具不扫描源码、自动登记 Case 或执行测试；核心 `check`、查询和 `sync-index` 只读取 Case 与索引。

项目快照与校验按以下边界衔接：

1. `snapshot:test-evidence` 产生 schema v2 实体快照；引用检查必须同时接收独立的 expected source。
2. `check:test-evidence-catalog` 先检查 Case/index，再计算当前项目测试来源 revision。若 `.log/vibe-check/cache/test-evidence-snapshots-v1/<revision>.json` 是通过 schema、expected source 与引用校验的完整 snapshot fact，则复用实体集合；否则重新生成，并以同一 revision 发布可丢弃 cache。
3. 无论是否命中缓存，Case 引用、实体覆盖和结束来源漂移都在本次重新判断。快照引用有效不等同于测试执行通过，未引用实体在通用核心中合法。
4. Case 正文变化后运行 `sync:test-evidence-catalog`；完整检查中的 `check:test-evidence-catalog` 不写回版本管理文件。

项目快照在单次调用内共享模块源码、import 与文件存在性事实，注册形状的规则匹配事实也在同次会话中共用，各 command 的可达闭包和注册集合仍独立计算；起止 source fingerprint 独立读取。每次顶层调用创建新会话，输入事实不跨调用复用。

项目快照生产和旧账本迁移不属于 `bun run test-evidence` 的常规 Case CLI。需要人工检查或交接快照时，使用 `bun run snapshot:test-evidence -- --output <new-file>`；`migrate:test-evidence` 的 expected source 必须从生成快照所用的同一项目输入边界独立计算或核验，不能直接抄录待验证快照的 source 三字段。迁移命令默认只预演，只有明确追加 `--write` 才写入；支持范围、映射阻断和恢复边界由 [Case 账本契约](../skills/test-evidence-review/references/catalog-contract.md#迁移) 承接。日常查询、同步和检查不得把旧 topic/`Entry:` 当作 fallback 输入。

## 源码与依赖边界

1. `scripts/` 只承接主仓库命令编排、构建适配、校验、打包、Git 和 CI 自动化。
2. 顶层脚本只保留入口与编排；`scripts/build/` 承接生成适配，`scripts/lib/` 承接跨脚本共享能力，`scripts/validators/` 承接项目校验项。各目录可以按命令阶段或独立不变量拆分内部模块；稳定的维护命令和明确保留的入口/导出才是跨 owner 消费边界，内部文件名或拆分层级不是文档契约。
3. `tools/<tool-name>/src/` 承接同步后随 skill 分发的运行时源码，`api/` 承接确需独立维护的公共声明源，`tests/` 承接源码、分发模块和 fixture 验证。skill 的公开程序化边界由生成制品及其声明入口确定，不包括任意 `src/` 子模块。构建适配器选择的源码入口则是维护源码与生成制品的边界：移动或替换该入口时，同步更新 `scripts/build/` 映射、生成头和对应 `sync:*`/`check:*`，而仅拆分入口相邻的内部职责模块不需要在本文另建文件索引。Task Graph 按其[局部决策](decisions/distribute-editable-typescript-runtimes.md)从运行时公开导出机械生成声明，不维护重复的 `api/` 源。Change Plan 只同步可直接 import 的当前 TS 运行时，不建立稳定 SDK 或声明源。
4. `tools/shared/` 承接多个工具已经真实共享的运行时不变量，以及项目明确选定并预置、具有独立契约的基础实现原语；预置原语不降低其他共享代码的准入条件。当前共享职责包括版本管理、文件文本检索、关系图、Markdown/Node 基础原语和 [`Option`](../tools/shared/src/option.ts)；具体入口与局部契约由源码目录承接。[版本管理中间层](../tools/shared/version-control.md)完整说明版本管理语义，[关系图基础能力](../tools/shared/src/graph/relations.ts)负责保序建图、显式边排序、节点 trace 和结构问题；其源码与测试分别承接实现和验证。关系类型、生命周期、时序和诊断映射仍由领域工具负责。
5. 跨领域协议由各自 owner 承接：`tools/skill-package/` 维护 skill 版本及发布端/updater 共用的 release manifest；[Index Runtime](../tools/index-runtime/README.md)维护派生索引协议和记录 stage 协调；[共同记录操作](../tools/record-operations/README.md)仅为 Decision Records 与 Investigation Report 编排操作，依赖 Index Runtime 与 shared。两域保持独立模型、公开边界和分发；仓库专用的临时 package hash 留在 `scripts/lib/`。
6. 领域工具可以依赖自身源码、`tools/shared/`、`tools/skill-package/`、明确建立的跨领域协议、目标运行时和显式外部依赖；不能依赖 `scripts/`、`skills/`、`dist/` 或另一个领域工具。
7. 根目录 `tsconfig.json` 统一提供 IDE 与类型检查配置；仓库源码运行、同步适配和普通测试由 Bun 负责。真实 Node smoke、Task-graph native lock 集成测试和分发 CLI 是明确例外，使用对应 skill manifest 与 help 公布的 Node.js engine。
8. 外部 JSON 在边界做运行时收窄。同一结构被多个入口消费或需要稳定字段诊断时，以 Valibot Schema 为结构真源；跨语言契约从同一 Schema 生成 JSON Schema 和分发声明。
9. 校验器检查长期源文件、链接和项目约束，不解析或正则匹配 GitHub Actions workflow 内部结构；workflow 行为由代码审查和实际运行验证。

实现代码的归属、边界处理、类型表达和风险验证继续遵循 [编码规范](coding-style.md)。

## 生成与分发

### Skill 接入

新增 skill 时完成以下项目集成；能力设计与行为契约由 skill 维护流程承接。

1. 在 `skills/<skill-name>/` 放置 `SKILL.md` 和所需资源，并在 frontmatter 写入初始 `metadata.version`；版本格式与提升规则见[制品身份与独立版本](#制品身份与独立版本)。
2. 需要随包分发的工具实现时，按[源码与依赖边界](#源码与依赖边界)确认源码与构建适配 owner，再通过相应 `sync:*` 生成包内产物。
3. 同步 `AGENTS.md` 的 skill 速览；按需在 `docs/skills/` 增加人类介绍，并更新 `README.md` 中对应入口。
4. 确认聚合打包和自更新入口能够发现并覆盖该 skill，完成结构、生成一致性和适用仓库验收。打包输入、updater 与发布要求继续由本节和 [CI 与发布](#ci-与发布)承接。

### 源码、入口与使用者

- `tools/` 保存 TypeScript 运行时与必要声明源；`scripts/build/` 适配器组合领域入口、updater、可达模块与资源，统一同步每个 skill 的受管文件和 manifest。
- 自有入口与运行时全部以 `.ts` 分发，模块关系保留在包内 `scripts/runtime/`；第三方依赖由包管理器安装。必要的 `.d.mts` 公开声明及 Schema 继续由领域 owner 维护或生成，普通源码子模块不因此成为稳定 SDK。
- 公开 TS 模块可导入而不执行 CLI、修改退出状态或产生文件和网络副作用；作为主模块运行时才进入 CLI。消费者使用 Node 原生类型擦除，无需 Bun、tsx 或构建工具。静态语法约束见[编码规范](coding-style.md#4-用类型表达领域含义)，运行兼容性仍由真实 Node smoke 验证。
- 仓库维护修改 `tools/` 源码 owner 后运行对应 `sync:*`；安装者可直接修改包内 TS，无需构建，但更新会覆盖正式制品中的同路径定制。生成头标明维护源码、skill 来源与同步命令，不写时间戳或本机绝对路径。

### 依赖安装与恢复

每个 skill 随包提供独立 `package.json`、`pnpm-lock.yaml` 与 `.gitignore`。manifest 声明实际源码闭包的依赖、Node engine 和固定 pnpm；同步器维护 manifest 与忽略规则，锁文件由维护者显式刷新。

已有兼容宿主依赖时可直接运行。Node 按标准模块规则解析，不按 manifest 范围选择版本；兼容性由支持范围和实际 API/行为契约判断，不以依赖来源、安装目录、本地 `node_modules` 或锁文件精确版本设额外门槛。native/optional 能力继续由领域 owner 声明和验证。

需要独立安装、复现基线或修复依赖时，使用随包 manifest 固定的 pnpm：

```bash
pnpm --dir "<skill-directory>" install \
  --ignore-workspace --prod --frozen-lockfile \
  --config.node-linker=isolated
```

该命令保持单 skill 的安装边界。仅在具体依赖确需配置时添加 `pnpm-workspace.yaml`，由相应 owner 说明配置并验证固定 pnpm 的实际行为。

启动、help、普通 import 和检查不隐式安装。updater 自身无法加载时，先显式修复依赖；运行时、manifest 或锁文件损坏时，重新获取完整 skill 后再安装。知识型 skill 的指令使用无需安装其 updater 依赖。源码更新与依赖兼容性分别核对，完整更新与恢复契约见 [Skill Updater](../tools/skill-updater/README.md#运行前置与恢复)。

### 同步与只读检查

`sync:*` 和 `check:*` 使用同一源码、入口、资源、manifest 与忽略规则的受管集合和生成路径。同步写入预期产物并清理已知过期受管文件；检查只读重建、规范化 CRLF 后比较，受管集合中缺失、过期或内容变化均是漂移。仓库同步的清理责任不改变客户端 updater 保留其他本地文件的契约。

统一生成在单次调用内采集源码引用与根 manifest 事实，再以只读参数传给领域适配器和 updater 生成。每个 skill 仍独立遍历自己的可达模块并生成受管产物；独立领域命令自行采集本次事实，事实绑定本次 workspace，消费时校验来源一致，不跨 workspace 或顶层调用复用。

manifest 依赖变化后，使用固定 pnpm 显式刷新相应 skill 的锁文件：

```bash
pnpm --dir "<skill-directory>" install \
  --ignore-workspace --lockfile-only \
  --config.node-linker=isolated
```

同步检查只核对 manifest 与锁文件中的直接依赖声明一致；完整依赖解析可用性由独立 frozen 安装证明。`sync:skill-updaters` 与 `check:skill-updaters` 覆盖全部 skill 的联合运行时，包括同时带领域工具的 skill。

### 打包输入

`pack:skills` 不临时构建或安装，只收集版本管理 `pending` 快照中的稳定分发输入。hash 与 zip 使用同一清单，排除依赖目录、pnpm store、缓存及安装残留；强制暂存这些内容也不能带入制品。

### 源码与分发映射

| 维护源码 | 分发目标 |
| --- | --- |
| `tools/novel-cards/` | `skills/novel-cards/scripts/novel-cards.ts` 与包内运行时；构建适配为 `scripts/build/novel-cards.ts` |
| `tools/video-understanding/` | `skills/video-understanding/scripts/video.ts`、包内运行时及媒体辅助／安装资源；构建适配为 `scripts/build/video-understanding.ts` |
| `tools/lightweight-judgment/` | `skills/lightweight-judgment/scripts/lightweight-judgment.ts` 与包内运行时；`migrations/` 下的版本迁移 SQL 同步到该 skill 对应迁移目录，迁移记录手工维护；支持的转换见[迁移清单](../skills/lightweight-judgment/migrations/README.md)；构建适配为 `scripts/build/lightweight-judgment.ts` |
| `tools/change-plan/` | `skills/change-plan/scripts/change-plan.ts` 与包内运行时 |
| `tools/decision-records/` | `skills/decision-records/scripts/decision-records.*` 和索引 Schema |
| `tools/investigation-report/` | `skills/investigation-report/scripts/check-investigations.*` 和索引 Schema |
| `tools/task-graph/` | `skills/task-graph/scripts/task-graph.*`、包内 SDK 声明树和 task index Schema |
| `tools/skill-validator/` | `skills/skill-maintainer/scripts/validate-skill.*` |
| `tools/test-evidence/` | `skills/test-evidence-review/scripts/` 与 `references/schemas/` 中的生成产物 |
| `tools/skill-updater/` | 每个 skill 的 `scripts/update-skill.ts` 与包内运行时；具体契约见 [Skill Updater](../tools/skill-updater/README.md) |
| `tools/index-runtime/` | 不独立分发，由当前领域同步器复制到对应包内模块闭包 |
| `tools/record-operations/` | 不独立分发，由 DR/IR 同步器各自复制实际可达操作模块，不依赖另一 skill |
| `tools/mcpshell-workspace-bridge/` | `skills/mcpshell-workspace-tools/scripts/{init-mcpshell-workspace,mcpshell-workspace}.ts`、包内运行时与 `references/mcpshell-tools.yaml` |

修改 `tools/shared/`、`tools/index-runtime/`、`tools/record-operations/`、`tools/skill-package/` 或其他跨领域维护源码时，按上表与实际导入关系确定全部受影响 consumer，再逐一运行其全部 `sync:*` 和对应 `check:*`。同步范围以实际消费闭包为准，包含未独立分发的共享源码。

### 制品身份与独立版本

Skill hash 和 zip 使用相同的版本管理 `pending` 快照，只覆盖最终进入 `skills/<skill-name>/` zip 的文件。默认 Git 实现把 `pending` 映射到 index，避免工作区覆盖和跨平台换行改变待提交制品。聚合 hash、zip 和 release 检测始终纳入每个包内文件的原始字节；这保证源码、锁文件、声明及其他制品字节改变都能得到不同的制品身份。

每个 `SKILL.md` frontmatter 的 `metadata.version` 是手动维护的正整数字符串独立版本。版本门禁只对版本承载变化要求提升，以下变化不承载版本：

1. `scripts/` 内生成的 `.mjs.map` 调试元数据编辑、新增或删除，且该文件由相邻 `.mjs` 的最后一个非空行以完整 `//# sourceMappingURL=<basename>` 指令链接。
2. 成对存在的 `.d.mts` 声明以根目录 `.oxfmtrc.json` 的配置规范化后比较，只有格式不同。

运行时 `.ts`、manifest、锁文件、声明语义、普通包内容以及声明的新增或删除仍承载版本，必须提升版本。版本例外不改变上述原始字节参与制品身份的规则。

`hash:skills` 只在本次命令运行期间计算全部 skill 的聚合 hash，不把 hash 或 lock 写入仓库。它将 Git `pending` 快照中发生的版本承载变化与指定 Git 基线 `SKILL.md` 中的 `metadata.version` 比较；pre-commit hook 默认使用 `HEAD`。release Gate 将 `--baseline-ref <ref>` 交给 prepare；prepare 在普通 Check 结算期间解析该基线并运行版本分析，authorization 只消费 prepare 保留的结果。本地 release Gate 缺省基线为 `HEAD`，CI 传入事件基线。hash 用于标识本次制品，既不是 updater 输入，也不是长期状态。

`pack:skills` CLI 每次从自己读取的 pending snapshot 重建 `dist/` 中的 zip 与 manifest。release tag 的 `pack:skills` Check 则从 prepare 已捕获且经 version authorization 的同一内存 snapshot 走同一打包入口，不重新读取 Git index。项目文档、`tools/`、`scripts/`、CI 和仓库元数据不进入 zip；只有这些内容同步为 skill 内生成产物后，才会改变对应 skill hash。

## Git hook

### 启用与授权

标准 `node scripts/environment.js setup` 会启用当前 worktree 的整组仓库 hook。只需要单独恢复平台 hook 条件或 `core.hooksPath` 时运行：

```bash
bun run setup-hooks
```

当 `core.hooksPath=.githooks` 且当前平台所需的 hook 文件条件已经满足时，仓库 hook 视为已启用。启用即表示使用者预先授权下文定义的 `post-commit` 自动推送；agent 获得当前 commit 授权后，不需要再次索取该自动推送的授权，也不主动绕过 hook。当前任务明确要求停用或限制自动推送时，该要求优先。

该授权只覆盖 hook 自动调用 helper 后产生的精确外部写入，不覆盖手工调用 helper、手工或强制 push、其他 remote/ref。由于启用动作建立持续的自动外部写入，setup 入口继续属于需要使用者明确选择的有副作用命令。

### Hook 行为

`.githooks/pre-commit` 通过 `hash:skills --quiet` 只读检查 Git index；包内容变化但对应 `metadata.version` 未提升时命令失败。该 hook 不写文件，也不自动 stage。

`.githooks/post-commit` 在 commit 已经完成后调用 `scripts/auto-push.ts`，其边界如下：

1. **目标条件**：仅当当前 symbolic branch 是 `main` 且存在 `origin` 时进入推送流程；其他 branch、detached HEAD 或缺少 `origin` 时跳过。
2. **更新方式**：只执行非强制的 `refs/heads/main:refs/heads/main` push；Git 的普通 fast-forward 规则拒绝远端分叉或其他非快进更新，不改用 force、其他 branch 或其他 remote。
3. **频率上限**：自动推送按尝试节流，而不是按成功结果节流。helper 在发起 push 前，以 Git common dir 共享的 `refs/codex/auto-push/last-attempt` blob 保存毫秒时间戳，并用 `update-ref` compare-and-swap 协调 linked worktree；同一仓库滚动一小时内至多保留并发起一次尝试。
4. **失败结果**：网络、权限或远端冲突造成的失败也占用当前一小时窗口；节流状态无法可信读取、解析或更新时不推送。helper 返回失败并输出诊断，hook 吸收该状态，因此已经完成的 commit 不回滚。
5. **后续触发**：hook 不创建 timer 或后台重试；窗口结束后的下一次符合条件的 commit 才会再次尝试，并推送届时 `main` 累积的提交。

节流 ref 不属于 `main`，上述显式 push refspec 不会发布它。GitHub Actions 不能修改已经 push 的 commit；PR 合并阻断还需单独配置并核对下文的远端必需检查。

### 平台与 Git 环境

Hook 源文件通过 `.gitattributes` 固定使用 LF，并在 Git index 中保存为 `100755`。POSIX Git 会检查工作区执行位，因此 setup 对当前 worktree 的 `pre-commit` 和 `post-commit` 重新执行 `chmod 0755`；原生 Git for Windows 的 `access(X_OK)` 兼容层忽略 `X_OK`，因此 Windows setup 不把 `chmod` 当作启用机制，而是依赖 LF 脚本存在且 `core.hooksPath=.githooks`。环境测试使用真实 `git commit` 验证两类 hook 被调用，并以启用 checkout 换行转换的 clone 验证 LF 契约。完整 Gate 的持续验收位于 Linux；Windows 视频 job 不承担全仓环境或所有 hook 的平台资格证明，平台结果仍以实际执行范围为准。

Git 调用 hook 时会注入当前 worktree 的 `GIT_DIR`、`GIT_INDEX_FILE` 等 repository-local 环境变量。两个 hook 在取得当前顶层路径后先清除 `git rev-parse --local-env-vars` 声明的变量，再从该顶层运行各自 helper；这样 nested Git 会重新识别当前 worktree、共享 common dir 及其正确 index，而不会继承 hook 调用点的局部覆盖。

## CI 与发布

### 任务交付与远端验收

日常任务以适用的本地验收为交付依据，远端 CI 默认异步；远端合并与聚合发布各自满足对应门禁：

| 层次 | 完成依据与执行边界 |
| --- | --- |
| 日常反馈 | `bun run check` 提供 quick 反馈，不代替完整变更验收。 |
| 本地任务交付 | 按[仓库验证要求](../AGENTS.md#验证与交付)完成对应改动范围的本地验收后，凭本地证据交付任务结果；远端 CI 通常异步运行，不默认等待整个 workflow 结束，也不默认增加本地全量 release。 |
| 远端合并／聚合发布 | 下文的 Linux／Windows 产品门禁、job 依赖与实际生效的远端必需检查约束对应合并或发布动作，不自动成为每次 agent 任务的同步等待条件。 |

需要远端证据的任务（例如修复 CI、验证远端发布或补足本地无法验证的平台边界），等待对应 revision 的必要 job 与制品结果。等待范围由任务的证明责任决定；创建 Change、修改 Gate 或触发 workflow 本身不增加等待义务，本地 full／release 同样按实际改动的证明责任选择。

已知相关 CI 失败在授权范围内处理；无法解决时报告失败、影响和剩余验证。交付分别说明本地结果与远端已知状态；所需远端证据未取得时，该项验收保持未完成，未查询、运行中或缺失的结果均不声称通过。

### 聚合发布流水线

`.github/workflows/package-skills.yml` 使用同一受测 revision，按两类产品门禁组织流水线：

| Job | 范围与责任 |
| --- | --- |
| `package`（Ubuntu） | 固定工具链下的完整 release Gate，覆盖全仓质量、结构、类型、Case/index、联合同步、事件基线版本/hash 与全部 skill 打包；上传 `skills` artifact。 |
| `video-windows`（Windows） | 依赖 `package`，checkout 其输出的 `tested_revision`，下载同次 workflow 的 `skills` artifact，以 `accept:video-windows` 验收视频源码和其中的实际视频 zip。 |
| `publish` | 同时依赖 `package` 与 `video-windows`，保留既有发布触发条件；任一门禁失败、取消或缺失成功结果均不能发布整批 skills。 |

两个产品门禁覆盖每次现有 PR、main push 和手动打包 workflow，包括仅修改共享依赖或其他 skill 的情形。必需验收保持实际执行，不以路径过滤或成功跳过替代。Windows 视频失败也阻断未改动 skill 的聚合发布，以沿用一条发布链；取舍见[平台验收决策](decisions/require-windows-video-acceptance-for-aggregate-release.md)。

Linux `package` 复用本地稳定入口：

1. 安装固定 Bun、Node、pnpm 和 Go，执行 `pnpm install --frozen-lockfile`。
2. 在同一 package job 安装 SCC 4.0.0，并在运行门禁前精确探测版本；函数指标无需额外分析器。
3. Checkout 后先确认非空、非全零的事件基线在本次仓库历史中可解析；不可解析时明确失败，不能把 force-push 前的基线悄悄替换成 `HEAD`。随后运行 `bun run check --tag release --cold --baseline-ref <event-baseline>`，在唯一 Gate aggregate 内完成前置检查、相对事件基线的独立版本校验和全部 skill 打包；只有事件未提供有效基线时省略该参数，release Gate 才回退 `HEAD`。
4. 运行 `bun run hash:skills --github-output --baseline-ref <event-baseline>`，重复廉价版本校验并输出本次聚合 hash；该步骤位于已经通过的 release 终结 Check 之后，不能绕过发布版本门禁。
5. 上传全部 `dist/*` 作为保留 7 天的 `skills` workflow artifact，供当前 workflow 的 Windows 验收、发布或短期 PR 核对使用。两类门禁均成功的 `main` 构建才进入发布 job；发布器对照远端资产的名称、大小和 SHA-256 digest，完全一致时不执行远端写入，从而在先前含 skill 改动的构建失败后由下一次成功构建补发。
6. package job 失败且存在 Gate invocation 时，额外上传保留 3 天的机器结果、progress 与命令 transcript，供定位失败 Check；不上传可复用 cache。若事件基线已不可解析，可在 `main` 手动触发 `workflow_dispatch` 重新验证并重新发布当前制品；它不会恢复已丢失的历史基线比较。

Windows 组合入口、独立安装与测试维护见[视频工具维护](../tools/video-understanding/README.md#windows-开发与制品验收)。该入口须消费同次 Linux 打包的原 zip；重新打包或工作树副本属于不同的验收对象。

fixture 的证明范围限于实际断言的入口、路径、资源、配置、依赖、更新与进程行为。实际媒体、网站、OCR 模型及客户端发现按具体任务授权另验，其他 skill 的平台范围保持不变。

### PR 合并保护

维护者在首次配置或 workflow job 身份变化后完成以下核对：

1. 取得当前平台上 `package`、`video-windows` 的实际 check 身份与受测 revision。
2. 将二者同时设为远端 ruleset／分支保护的必需检查，验证失败、取消或缺少成功结果时均阻止 PR 合并。
3. 保存实际配置与阻断证据。尚未配置、权限或平台能力不足时，明确报告远端保护未证明生效，等待授权或配置后再核对；本地验收通过不能声明 PR 已受保护。

YAML 的 job 依赖约束发布；远端合并保护以本节生效核对为准，本地测试和文档声明不代替该证据。

### 发布职责与输入

1. workflow YAML 只承接触发条件、权限、job 依赖和运行时准备，不实现发布事务。
2. `scripts/publish-skills.ts` 是薄 CLI 入口，`scripts/lib/publish-skills.ts` 是唯一发布实现 owner；实现内部按命名单元处理输入、资产、Git/`gh` 边界、GitHub 响应和发布顺序。
3. 发布 job 从仓库根目录调用 `bun run publish:skills -- <rolling|snapshot>`。CLI 从 `dist/` 读取 zip 与 manifest，并要求 `GH_TOKEN`、`GITHUB_SHA` 和 `PACKAGE_HASH`；输入或资产无效时，在执行 Git 或 GitHub 命令前失败。

### 发布触发与结果

发布 job 只在 `main` 上运行，触发与结果如下：

| 触发条件 | 发布结果 |
| --- | --- |
| `pull_request` | 不发布 Release；只保留短期 workflow artifact。 |
| `main` push 且当前制品与远端资产不同 | 更新 `skills-latest` 的 tag 与完整资产集，并把该滚动 Release 标记为 GitHub Latest。 |
| `main` push 且当前制品与远端资产相同 | 发布 job 只读核对后跳过远端写入。 |
| `main` 上的 `workflow_dispatch`，`publish_snapshot=false` | 核对并按需同步当前制品到 `skills-latest`，不创建历史快照。 |
| `main` 上的 `workflow_dispatch`，`publish_snapshot=true` | 核对并按需同步 `skills-latest`，再为当前聚合 hash 创建或核对一个不可变快照。 |
| 非 `main` 分支上的 `workflow_dispatch` | 不发布 Release；只保留短期 workflow artifact。 |

### 发布一致性

`skills-latest` 是正式滚动发布入口和 GitHub Latest，updater 默认读取该 Release。更新已有滚动 Release 时先覆盖各 skill zip，最后覆盖 manifest；全部当前资产可用后才删除不再属于当前制品的旧资产并更新 Release 元数据，使失败后的后续运行能够重新同步。updater 会拒绝 zip 版本与 manifest 不一致的制品，不会把发布中断产生的混合资产写入本地 skill。

滚动发布的无变化判断以完整资产清单、字节数和 GitHub 提供的 SHA-256 digest 为准，不以本次 push 的 Git diff 或 Release tag 所指提交为准；缺失 digest 时保守地重新同步。这样失败构建遗留的待发布内容可由后续成功构建恢复。

不可变快照 tag 使用聚合 hash 前 12 位：`skills-<hash12>`。相同制品只对应一个快照；同名快照已存在时，发布脚本逐项核对资产名称、字节数和 GitHub 提供的 SHA-256 digest，一致则复用，任一字段缺失或不同则失败且不修改快照。显式 `--release-tag` 只用于仍被保留的不可变快照或历史 Release。
