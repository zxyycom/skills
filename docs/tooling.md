# 项目工具链

本文承接主仓库从环境准备到 skill 制品发布的项目级工具链：依赖与运行时分工、package scripts、`scripts/` 与 `tools/` 的边界、生成和校验、Git hook、CI 与 release。具体组件的内部契约由相邻源码目录承接，实现代码的通用质量规则由 [编码规范](coding-style.md) 承接。

## 内容边界

本文件负责：

1. 开发环境如何准备，以及 pnpm、Bun 和 tsgo 分别承担什么责任。
2. 维护者应调用哪些稳定命令，以及 `test:*`、`sync:*`、`check:*` 的关系。
3. 主仓库自动化、可分发工具源码和 skill 包内产物如何单向衔接。
4. 本地检查、Git hook、CI、skill hash、独立版本、打包和 release 如何组成交付流程。

本文件不展开单个 skill 的行为、工具内部 API、决策与调查格式或通用编码规则。需要修改具体组件时，继续读取对应源码目录及其局部契约：

- [Index Runtime](../tools/index-runtime/README.md)
- [版本管理中间层](../tools/shared/version-control.md)
- [Skill Updater](../tools/skill-updater/README.md)

## 工具分工

1. pnpm 负责安装依赖；固定版本来自 `package.json#packageManager`，锁文件是 `pnpm-lock.yaml`，CI 使用 `pnpm install --frozen-lockfile`。
2. Bun 负责 package scripts 调度和 TypeScript 脚本运行；本地、hook 和 CI 优先通过 `bun run <script>` 使用稳定入口。最低兼容版本由 `package.json#engines.bun` 单独定义，环境入口从同一边界诊断 Bun，不在本文复制版本数值。
3. tsgo 负责类型检查；`typecheck` 使用固定版本的 `@typescript/native-preview`，对应 release-age 例外记录在 `pnpm-workspace.yaml`。
4. 常见格式、协议、解析和压缩能力优先使用成熟依赖；项目领域规则才由本仓库直接实现。

## 环境自举

`scripts/environment.js` 是进入项目工具链前的跨平台独立入口，只使用 Node.js 标准库，不依赖 Bun、pnpm、项目包或 `bun run check`。`check` 明确表示只读诊断，`setup` 明确表示会补齐工具、依赖和仓库本地配置。

只读检查环境：

```bash
node scripts/environment.js check
```

补齐 Bun、pnpm、锁定依赖和仓库本地配置：

```bash
node scripts/environment.js setup
```

环境入口遵守以下边界：

1. Git、Node.js、全局 CodeGraph、SCC 3.7.0 和 Lizard 1.23.0 是前置条件；入口只诊断和复用它们，不安装或升级它们。
2. `check` 检查 Git、Node.js、Bun、pnpm、CodeGraph、SCC、Lizard、索引状态、直接依赖、Git hook 和中央 task-graph root，不下载或修改环境。
3. `setup` 只会安装或切换 Bun、pnpm，运行 `pnpm install --frozen-lockfile`，调用已就绪的全局 CodeGraph 执行 `init` 和 `sync`，并配置当前 worktree；SCC/Lizard 缺失、版本不匹配或探测失败时会在任何安装前失败并给出恢复命令。
4. 恢复外部指标工具时，让对应精确版本进入 `PATH`：SCC 使用 `go install github.com/boyter/scc/v3@v3.7.0`；Lizard 可使用 `uv tool install lizard==1.23.0`。环境入口不替代类型检查、测试、生成漂移检查或完整仓库检查，也不由这些入口反向调用。

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
| `bun run format:check` | 只读检查 `format` 覆盖的全部维护源码；default 与 full 门禁均执行 |
| `bun run fix` | 依次运行覆盖 `scripts/` 与 `tools/` 的 `lint:fix` 与 `format`，用于安全地修复维护源码 |
| `bun run validate` | 校验全部 skill 入口、当前维护的仓库 Markdown 链接和主仓库配置 |
| `bun run hash:skills` | 从 Git `pending` 快照临时计算 package hash，并校验内容变化的 skill 已相对 `--baseline-ref` 提升 `SKILL.md` 中的 `metadata.version` |
| `bun run pack:skills` | 从版本管理 `pending` 快照生成每个 skill 的 zip 和 release manifest |
| `bun run publish:skills -- <rolling\|snapshot>` | 供发布 workflow 校验 `dist/` 制品并执行滚动发布或不可变快照事务；需要 GitHub Actions 提供的 `GH_TOKEN`、`GITHUB_SHA` 和 `PACKAGE_HASH` |
| `bun run setup-hooks` | 配置当前 worktree 的 `core.hooksPath`，并在 POSIX 文件系统恢复 hook 可执行权限 |
| `bun run setup-repository` | 配置当前 worktree hook，并确认当前项目的主 worktree 可作为默认 task-graph root |
| `bun run check` | 运行 Vibe default：选择当前 catalog 标为 default 的工作区正确性 Check；不实例化 release version 或 `pack:skills`。 |
| `bun run check --full [--baseline-ref <ref>]` | 运行 Vibe full：保留 default 覆盖，并加入 catalog 标为 full 的 Check、release version 和打包终端。版本检查从 Git `pending`（index）快照相对显式基线执行；省略基线时使用 `HEAD`，CI 使用事件基线。 |

### 权威 Vibe 门禁

`bun run check` 是唯一权威门禁入口。`scripts/vibe-check.ts` 只解析无参数的 default，或带可选 `--baseline-ref <ref>` 的 full；`<ref>` 必须是已 trim 的非空 revision 输入，且不得以 `-` 开头、包含 NUL、CR 或 LF。该 wrapper 级验证不解析 Git ref；实际解析仍由 release version Check 内的 `hash:skills` 完成。CLI 将 Vibe 的最终结果映射为进程退出状态；`scripts/lib/vibe-gate.ts` 是语义 Check catalog、Definition、命令 adapter 和 release DAG owner。`--verbose`、`CHECK_CONCURRENCY`、旧摘要 renderer 和候选 `vibe-check` 命令均不是当前契约。

| 术语 | 当前含义 |
| --- | --- |
| semantic Check | catalog 中以稳定 ID、显示名、profile 和直接命令定义的最小 Gate 单元。ID 与命名表达可行动的证明边界和失败后的 owner 路由；测试文件与 package script 只是其执行容器。 |
| selected Check | 当前 Definition 按 profile 从 catalog 展开的 Check；full 还加入两个 release DAG 节点。`all` aggregate 结算当前选择的全部 Check。 |
| blocking Check | finding、failed、unavailable 或意外 not-applicable 都使当前 aggregate 失败。 |
| required advisory Check | 可信 finding 仍以 warning + passed 结算，不影响 aggregate 或 release 资格；无法执行、结果不可信或意外 N/A 则 fail closed。 |
| default / full | default 保持原有日常工作区覆盖；full 保持 default 覆盖，并加入原本属于 full 的领域或 release 能力。profile 表达交付范围，不按预计耗时、并行度或文件数量重分组。 |
| release-required Check | full 中普通的原生、维护脚本和语义 Check。每项必须形成可信 passed，release version Check 才会开始；该集合由 catalog/Definition 派生，不在本文维护易过期的 ID 清单。 |

Check catalog 以“它证明什么、失败后由谁处理”为分组条件：例如领域记录/索引、生命周期事务、按稳定 ID 的 pending-stage、调用协议和可分发制品可以是不同 Check；共同证明一个契约的多个原生测试文件保留在同一 Check。不得为均衡耗时把 Check 拆成每个测试，也不得把一个工具的全部测试重新合并为单一 Check。package scripts 继续是面向维护者的稳定手动聚合入口，但语义 Check 不再以 package script 身份作为 leaf。失败结果给出的直接命令是重跑该 Check 的权威路径；需要完整领域回归时仍可运行相应 `test:*` 聚合命令。

两种 Definition 都使用 Vibe 原生 progress、静态 `maxParallel: 4` 和 `all` aggregate，明确令 `unavailable`、`not-applicable` 与空选择失败。调度顺序和并发设置不表达 Check 语义、失败优先级或 release 依赖；独立 Check 即使其他 Check 已失败仍继续结算。性能只作防退化观察：维护时确认 catalog 没有无真实共享契约的重复入口选择，不以单次耗时、平均分片或 worker 利用率改变 catalog、profile 或依赖。machine publication 默认写入专属且被 Git 忽略的 `.log/vibe-check/publication/`：`run.json` 保存本次运行的完整 Check facts，`records.ndjson` 保存 supplemental Records。catalog Check ID 是这些事实的稳定机器身份；显示名、声明顺序、调度结果和未来缓存命中都不能改写它。publication 是门禁结果的机器消费边界，不替代 CLI 退出码。面向 invocation 过程排障的 diagnostic log 默认关闭；只有显式启用时才在 `.log/vibe-check/` 写入带时间与 UUID 的独立日志。两类输出共用受控根目录，但不共用文件层级。CLI 只为非 completed RunResult 输出稳定的类别、原因和恢复提示，完成但 aggregate 不通过时退出 `1`。

六项原生 Check 共用当前维护范围：代码类 Check 读取 Git worktree 中 `scripts/`、`tools/` 的 JavaScript/TypeScript，并排除 Vibe 默认排除项、`changes/archive/**` 和 `docs/investigations/_resources/**`；JSON 与 Markdown 也排除这两类历史内容。重复检测只把不少于 150 tokens 的重复片段作为 blocking finding，避免把已知的小型维护片段误作门禁失败。

full 同时验证工作区正确性与 release snapshot，但两者输入不能互相替代：普通 Check 在本次项目根 invocation 中结算，原生 Check 明确选择 Git worktree，脚本或直接测试命令由自身契约决定读取输入；release version 与 `pack:skills` 共同消费 Git `pending` 快照，默认 Git 实现将其映射到 index。因此 full 通过不说明未暂存的工作树 skill 改动已进入制品；需要核对两者一致性时，分别检查工作树与 index。

| Check 类别 | 语义 |
| --- | --- |
| 结构与质量原生 Check | 重复、JSON、Task Graph/Test Evidence Schema、Markdown 链接的 finding、unavailable 或意外 not-applicable 均阻断 aggregate。 |
| 文件指标与函数指标 | required advisory：可信 finding 保持 passed，progress 显示 warning 摘要；逐项 finding 保存在 `.log/vibe-check/publication/records.ndjson`。unavailable 或 not-applicable 阻断。finding 数量和执行时长是测量输出，不是 catalog 边界。 |
| 语义 Check | adapter 以 catalog 声明的 `bun test` 或必要的 Node 原生命令运行精确测试入口。非零退出为 failed，不能启动、取消或无法形成可信退出结果为 unavailable；诊断提供同一命令以便直接重跑。 |
| 维护 package script Check | adapter 以参数数组运行 `bun run <script>`，保留既有稳定维护命令的行为验证；它不替代语义 Check。取消与后代进程回收边界仍由脚本协作处理。 |

full 的 release DAG 固定为：

```text
所有 full 普通 Check
          │ 全部可信 passed
          ▼
release:skill-version（运行 hash:skills，相对 baseline 校验 Git pending）
          │ passed
          ▼
pack:skills（恰好一次，从同一 Git pending 生成制品）
```

1. CLI 和 release version preflight 只验证 authored `baselineRef` 的输入形状：非空、没有首尾空白、不以 `-` 开头且不含 NUL、CR、LF；它们不声称该 Git ref 存在或可解析。
2. release version execution 将基线作为 supplemental Record 发布；只有全部 release-required Check 已可信 passed，才调用 `hash:skills`。任一普通前置不是 passed 时，version 与 packaging 均不开始，也不产生本次制品。
3. version failed 或 unavailable 时，`pack:skills` 不开始；只有 version passed 才恰好调用一次 `pack:skills`。版本节点保留基线，两个节点分别保留可定位的失败结果；`hash:skills` 不作为普通 package-script Check。pre-commit hook 仍独立以 `HEAD` 校验待提交版本。

当前锁文件解析 `@zxyycom/vibe-check@0.0.1`，两个窄 wrapper 只修复该版本实际暴露的兼容边界，不接管文件选择、parser、scheduler、aggregate 或工具安装：

1. `scripts/lib/vibe-jscpd.js` 保留 Vibe 的 `--version` availability probe；扫描必须携带 Vibe 生成的 `--config <path>`。Vibe 0.0.1 把 config 写在项目根外的临时目录，而 jscpd 从 config 所在目录解析相对 `path`；wrapper 只把该 config 中的相对文件项按项目当前工作目录改为绝对路径，然后转交 Vibe 随包的 jscpd。缺失或无效 config 在转交前失败，不能退回 jscpd 默认扫描范围。
2. `scripts/lib/vibe-lizard.js` 只在 availability probe 的 `lizard --version` 输出精确为 `1.23.0` 时通过；扫描调用的参数原样转交 PATH 中的 Lizard。Vibe 0.0.1 原生 availability 只要求非空版本输出，因此如 `1.23.1` 必须结算为 unavailable，而不是可信 finding 或 passed。

`fileMetrics` 直接使用 PATH SCC，Vibe 原生 availability 精确检查 `scc version 3.7.0`。两种 wrapper 都不安装、下载或管理工具。`node scripts/environment.js check` 精确报告 SCC/Lizard 缺失或版本不匹配，`setup` 不安装它们；CI 在同一 package job 固定安装并探测 SCC 3.7.0 与 Lizard 1.23.0 后运行 full。若锁文件解析的 Vibe 版本或任一外部工具的调用/输出契约改变，先复核这些 wrapper 的必要性与边界。

### 仓库维护短命令

“仓库维护短命令”指 `package.json#scripts` 中面向本仓库日常领域操作的稳定入口。它们统一使用 `bun run <command> -- <arguments>`，避免调用方重复 skill 安装路径，同时不建立第二套领域 CLI。

| 短命令 | 本仓库内用途 |
| --- | --- |
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
bun run test-evidence -- topics
bun run validate-skill -- skills/task-graph
```

task-graph 短命令另外承担项目 root 选择。省略 `--root` 时，它从当前 Git 仓库发现主 worktree，避免 linked worktree 静默形成第二份索引。提供唯一的 `--root <path>` 或 `--root=<path>` 时，相对路径以短命令所在 worktree 为基准解析，并切换到目标项目自己的 CLI 与 `docs/task-graph/task-graph-index.json`。缺值、重复 root、目标项目缺少 CLI 或索引时直接失败；短命令拒绝 `--index`。同一项目确需操作其他索引时，直接调用领域 CLI 并显式承担该选择。

### 工具维护命令

| 责任 | 行为测试 | 显式写入 | 只读检查 |
| --- | --- | --- | --- |
| Change Plan | `test:change-plan-cli` | `sync:change-plan-cli` | `check:change-plan-cli` |
| Decision Records | `test:decision-records-cli` | `sync:decision-records-cli` | `check:decision-records-cli`、`check:decisions` |
| Skill Validator | `test:skill-validator` | `sync:skill-validator` | `check:skill-validator` |
| Investigation Report | `test:investigation-report-check` | `sync:investigation-report-check` | `check:investigation-report-check`、`check:investigations` |
| Task Graph | `test:task-graph-cli` | `sync:task-graph-cli` | `check:task-graph-cli`、`check:task-graph-index` |
| Test Evidence | `test:test-evidence-cli` | `sync:test-evidence-cli`、`sync:test-evidence-catalog` | `check:test-evidence-cli`、`check:test-evidence-catalog` |
| Skill Updater | `test:skill-updater` | `sync:skill-updaters` | `check:skill-updaters` |
| 共享基础设施 | `test:check`、`test:environment`、`test:generated-file`、`test:index-runtime`、`test:relation-graph`、`test:skill-package-hash`、`test:version-control` | — | — |

`bun run validate` 的主仓库 Markdown 链接范围排除 `changes/archive/**` 与 `docs/investigations/_resources/**`。前者只作为 Change Plan 历史参考；active Change 在移动前由 `archive` 完成结构、基线、任务和目标路径门禁，归档后不再进入链接校验或 Change Plan checker。后者是 Investigation Report 保存的形成时字节，仍由资源引用与完整性门禁维护。active Change、调查根目录中当前维护的报告 Markdown 与其他当前维护 Markdown 继续参与链接校验。

三类前缀表达不同义务：

1. `test:*` 证明源码或分发模块的行为。
2. `sync:*` 是显式写入口，只在维护对应生成源时运行，不由完整检查自动写回。
3. `check:*` 只读验证仓库内容或生成产物；生成工具的 `sync:*` 与 `check:*` 必须使用同一构建路径。

只有具备独立维护操作、完整检查消费者或生成写入责任的命令才保留为 package script。`scripts/validators/project-config.ts` 检查这些稳定入口仍存在于 `package.json`。

本仓库使用固定的 `docs/test-evidence/` 根目录、其中的受控 topic 表、
每个 `<topic>/<slug>.md` 单 case 文件和固定派生索引维护测试账本。账本覆盖
`test:*` 稳定入口保留的历史与当前测试；一个 case 对应测试框架能够独立选择并
单独报告的一个最小原生测试节点。框架不限，本仓库当前沿用 `node:test` API 定义
节点；普通测试通过已固定版本的 `bun test` 执行，task-graph 真实 native lock
集成测试通过其声明支持的 Node.js `--test` 执行。该执行器分工只是现有依赖下的
简单选择。测试文件、package script 和完整检查仍只是聚合容器。topic 表与 case
由测试改动显式维护，
工具只读取固定根目录中的合法 topic 和 case，不扫描测试源码、自动收集或注册 case。
正文变化后运行 `sync:test-evidence-catalog`；`check:test-evidence-catalog` 已进入
完整检查并只校验显式 topic 根目录与统一索引。

## 源码与依赖边界

1. `scripts/` 只承接主仓库命令编排、构建适配、校验、打包、Git 和 CI 自动化。
2. 顶层脚本只保留入口与编排；`scripts/build/` 承接生成适配，`scripts/lib/` 承接跨脚本共享能力，`scripts/validators/` 承接项目校验项。
3. `tools/<tool-name>/src/` 承接需要构建后随 skill 分发的运行时源码，`api/` 承接确需独立维护的公共声明源，`tests/` 承接源码、分发模块和 fixture 验证。Task Graph 按其[局部决策](decisions/derive-sdk-declarations-from-runtime-source.md)从运行时公开导出机械生成声明，不维护重复的 `api/` 源。Change Plan 只生成可直接 import 的当前 MJS 运行时，不建立稳定 SDK 或声明源。
4. `tools/shared/` 承接多个工具已经真实共享的运行时不变量，以及项目明确选定并预置、具有独立契约的基础实现原语；预置原语不降低其他共享代码的准入条件。[版本管理中间层](../tools/shared/version-control.md)、[`Option`](../tools/shared/src/option.ts) 和[关系图基础能力](../tools/shared/src/graph/relations.ts)是当前共享组件。关系图基础能力负责保序建图、显式边排序、节点 trace 和结构问题；其源码与测试分别承接实现和验证。关系类型、生命周期、时序和诊断映射仍由领域工具负责。
5. `tools/skill-package/` 承接 skill 版本以及发布端与 updater 共用的 release manifest 协议；仓库专用的临时 package hash 留在 `scripts/lib/`。[Index Runtime](../tools/index-runtime/README.md) 承接已经建立的跨领域派生索引协议。
6. 领域工具可以依赖自身源码、`tools/shared/`、`tools/skill-package/`、明确建立的跨领域协议、目标运行时和显式外部依赖；不能依赖 `scripts/`、`skills/`、`dist/` 或另一个领域工具。
7. 根目录 `tsconfig.json` 统一提供 IDE 与类型检查配置；仓库源码运行、构建和普通测试由 Bun 负责。Task-graph 真实 native lock 集成测试和分发 CLI 是明确例外，使用其 skill frontmatter 与 help 公布的固定 Node.js engine。
8. 外部 JSON 在边界做运行时收窄。同一结构被多个入口消费或需要稳定字段诊断时，以 Valibot Schema 为结构真源；跨语言契约从同一 Schema 生成 JSON Schema 和分发声明。
9. 校验器检查长期源文件、链接和项目约束，不解析或正则匹配 GitHub Actions workflow 内部结构；workflow 行为由代码审查和实际运行验证。

实现代码的归属、边界处理、类型表达和风险验证继续遵循 [编码规范](coding-style.md)。

## 生成与分发

可分发工具统一遵守：

1. TypeScript 源码以及确需独立维护的声明源位于 `tools/`，读取仓库配置并写入 skill 的适配器位于 `scripts/build/`。
2. `sync:*` 至少生成自包含单文件 ESM `.mjs` 和 linked source map。只有行为 owner 明确建立稳定程序化接口时才同时生成 `.d.mts` 声明入口；声明需要拆分时，其余生成声明保留在同一 skill 的包内目录并只由入口引用。只有 owner 明确需要跨语言机器契约时才生成 JSON Schema 和 Schema 派生声明。
3. 生成模块可被导入而不执行 CLI、修改退出状态或产生文件和网络副作用；只有作为主模块运行时进入 CLI。
4. 分发产物只能依赖目标运行时和包内内容。共享源码由构建器内联，不形成跨 skill 运行时前置。Task-graph 的包内 ESM 保持自包含；mutation 另行加载调用方按该 skill 指引配置、并由 CLI 探测的 native runtime 扩展。该扩展不属于 skill 制品，也不改变通用 updater 或其他工具的分发边界。
5. 可嵌入注释的生成产物必须写明禁止直接编辑、仓库与维护源码、skill 源目录和重建命令；生成头不写时间戳或本机绝对路径。
6. `check:*` 在临时目录重建产物，并在把 CRLF 规范为 LF 后比较文本内容；除行尾形式外的差异视为生成漂移。`pack:skills` 不临时构建，只收集已经进入版本管理 `pending` 快照的 `skills/<skill-name>/` 稳定分发输入。

当前映射：

| 维护源码 | 分发目标 |
| --- | --- |
| `tools/change-plan/` | `skills/change-plan/scripts/change-plan.mjs` 与 `change-plan.mjs.map` |
| `tools/decision-records/` | `skills/decision-records/scripts/decision-records.*` 和索引 Schema |
| `tools/investigation-report/` | `skills/investigation-report/scripts/check-investigations.*` 和索引 Schema |
| `tools/task-graph/` | `skills/task-graph/scripts/task-graph.*`、包内 SDK 声明树和 task index Schema |
| `tools/skill-validator/` | `skills/skill-maintainer/scripts/validate-skill.*` |
| `tools/test-evidence/` | `skills/test-evidence-review/scripts/` 与 `references/schemas/` 中的生成产物 |
| `tools/skill-updater/` | 每个 skill 的 `scripts/update-skill.*`；具体契约见 [Skill Updater](../tools/skill-updater/README.md) |
| `tools/index-runtime/` | 不独立分发，由当前领域构建器内联到对应自包含模块 |

修改 `tools/shared/`、`tools/index-runtime/`、`tools/skill-package/` 或其他跨领域维护源码时，先按上表和实际导入关系定位受影响的领域 consumer；对每个受影响 consumer 依次运行对应全部 `sync:*`，再运行对应 `check:*`。共享目录不因没有独立分发目标而免于同步，也不因其共享身份无条件运行全部 `sync:*`。

Skill hash 和 zip 使用相同的版本管理 `pending` 快照，只覆盖最终进入 `skills/<skill-name>/` zip 的文件。默认 Git 实现把 `pending` 映射到 index，避免工作区覆盖和跨平台换行改变待提交制品。聚合 hash、zip 和 release 检测始终纳入每个包内文件的原始字节；这保证 source map、声明及其他制品字节改变都能得到不同的制品身份。每个 `SKILL.md` frontmatter 的 `metadata.version` 是手动维护的正整数字符串独立版本；版本门禁只对版本承载变化要求提升：`scripts/` 内由相邻 `.mjs` 的最后一个非空行以完整 `//# sourceMappingURL=<basename>` 指令链接的生成 `.mjs.map` 调试元数据编辑、新增或删除不承载版本，成对存在的 `.d.mts` 声明以根目录 `.oxfmtrc.json` 的配置规范化后比较，纯格式差异不承载版本；运行时 `.mjs`、声明语义、普通包内容以及声明的新增或删除仍承载版本，必须提升版本。

`hash:skills` 只在本次命令运行期间计算全部 skill 的聚合 hash，不把 hash 或 lock 写入仓库。它将 Git `pending` 快照中发生的版本承载变化与指定 Git 基线 `SKILL.md` 中的 `metadata.version` 比较；pre-commit hook 默认使用 `HEAD`。full 的 release 终结 Check 把 `--baseline-ref <ref>` 作为 authored options，preflight 仅验证 wrapper 输入边界，并在前置通过后由 `hash:skills` 解析该基线并运行版本比较；本地 full 缺省为 `HEAD`，CI 传入事件基线。hash 用于标识本次制品，既不是 updater 输入，也不是长期状态。

`pack:skills` 每次先清空 `dist/`，再分别生成 `dist/<skill-name>.zip` 和只包含独立版本的 `dist/skill-release-manifest.json`。项目文档、`tools/`、`scripts/`、CI 和仓库元数据不进入 zip；只有这些内容同步为 skill 内生成产物后，才会改变对应 skill hash。

## Git hook

标准 `node scripts/environment.js setup` 已包含 hook 配置。只需要单独恢复当前 worktree 的平台 hook 条件或 `hooksPath` 时运行：

```bash
bun run setup-hooks
```

`.githooks/pre-commit` 通过 `hash:skills --quiet` 只读检查 Git index；包内容变化但对应 `metadata.version` 未提升时命令失败。hook 不写文件，也不自动 stage。GitHub Actions 不能修改已经 push 的提交，需要阻止错误提交进入 `main` 时，应由 branch protection 或 ruleset 要求 CI check。

Hook 源文件通过 `.gitattributes` 固定使用 LF，并在 Git index 中保存为 `100755`。POSIX Git 会检查工作区执行位，因此 setup 对当前 worktree 重新执行 `chmod 0755`；原生 Git for Windows 的 `access(X_OK)` 兼容层忽略 `X_OK`，因此 Windows setup 不把 `chmod` 当作启用机制，而是依赖 LF 脚本存在且 `core.hooksPath=.githooks`。环境测试使用真实 `git commit` 验证 hook 被调用，并以启用 checkout 换行转换的 clone 验证 LF 契约；当前完整门禁仍只在 Linux 运行，不能表述为已经完成真实 Windows runner 验证。

Git 调用 hook 时会注入当前 worktree 的 `GIT_DIR`、`GIT_INDEX_FILE` 等 repository-local 环境变量。pre-commit 在取得当前顶层路径后先清除 `git rev-parse --local-env-vars` 声明的变量，再从该顶层运行 hash；这样 hash 内部按 skill 路径执行的 Git 发现会重新识别 linked worktree 及其 index，而不会把单个 skill 目录误判成仓库根。

## CI 与发布

`.github/workflows/package-skills.yml` 复用本地稳定入口：

1. 安装固定 Bun、Node、pnpm、Go 和 Python，执行 `pnpm install --frozen-lockfile`。
2. 在同一 package job 安装 SCC 3.7.0 与 Lizard 1.23.0，并在运行门禁前精确探测两个版本。
3. 运行 `bun run check --full --baseline-ref <event-baseline>`，在唯一 Gate aggregate 内完成前置检查、相对事件基线的独立版本校验和全部 skill 打包；workflow 遇空或全零事件基线时省略该参数，full 因而回退 `HEAD`。
4. 运行 `bun run hash:skills --github-output --baseline-ref <event-baseline>`，重复廉价版本校验并输出本次聚合 hash；该步骤位于已经通过的 release 终结 Check 之后，不能绕过发布版本门禁。
5. 上传全部 `dist/*` 作为保留 7 天的 workflow artifact，供当前 workflow 的发布 job 或短期 PR 核对使用。

### 发布职责与输入

1. workflow YAML 只承接触发条件、权限、job 依赖和运行时准备，不实现发布事务。
2. `scripts/publish-skills.ts` 是薄 CLI 入口，`scripts/lib/publish-skills.ts` 是唯一发布实现 owner；实现内部按命名单元处理输入、资产、Git/`gh` 边界、GitHub 响应和发布顺序。
3. 发布 job 从仓库根目录调用 `bun run publish:skills -- <rolling|snapshot>`。CLI 从 `dist/` 读取 zip 与 manifest，并要求 `GH_TOKEN`、`GITHUB_SHA` 和 `PACKAGE_HASH`；输入或资产无效时，在执行 Git 或 GitHub 命令前失败。

### 发布触发与结果

发布 job 只在 `main` 上运行，触发与结果如下：

| 触发条件 | 发布结果 |
| --- | --- |
| `pull_request` | 不发布 Release；只保留短期 workflow artifact。 |
| `main` push 且 skill 分发内容变化 | 更新 `skills-latest` 的 tag 与完整资产集，并把该滚动 Release 标记为 GitHub Latest。 |
| `main` push 且 skill 分发内容未变化 | 不运行发布 job，不覆盖 `skills-latest`。 |
| `main` 上的 `workflow_dispatch`，`publish_snapshot=false` | 重新发布当前制品到 `skills-latest`，不创建历史快照。 |
| `main` 上的 `workflow_dispatch`，`publish_snapshot=true` | 更新 `skills-latest`，并为当前聚合 hash 创建或核对一个不可变快照。 |
| 非 `main` 分支上的 `workflow_dispatch` | 不发布 Release；只保留短期 workflow artifact。 |

### 发布一致性

`skills-latest` 是正式滚动发布入口和 GitHub Latest，updater 默认读取该 Release。更新已有滚动 Release 时先覆盖各 skill zip，最后覆盖 manifest；全部当前资产可用后才删除不再属于当前制品的旧资产并更新 Release 元数据，使失败后的后续运行能够重新同步。updater 会拒绝 zip 版本与 manifest 不一致的制品，不会把发布中断产生的混合资产写入本地 skill。

不可变快照 tag 使用聚合 hash 前 12 位：`skills-<hash12>`。相同制品只对应一个快照；同名快照已存在时，发布脚本逐项核对资产名称、字节数和 GitHub 提供的 SHA-256 digest，一致则复用，任一字段缺失或不同则失败且不修改快照。显式 `--release-tag` 只用于仍被保留的不可变快照或历史 Release。
