# 项目工具链

本文承接主仓库从环境准备到 skill 制品发布的项目级工具链：依赖与运行时分工、package scripts、`scripts/` 与 `tools/` 的边界、生成和校验、Git hook、CI 与 release。具体组件的内部契约由相邻源码目录承接，实现代码的通用质量规则由 [编码规范](coding-style.md) 承接。

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

## 工具分工

1. pnpm 负责安装依赖；固定版本来自 `package.json#packageManager`，锁文件是 `pnpm-lock.yaml`，CI 使用 `pnpm install --frozen-lockfile`。
2. Bun 负责 package scripts 调度和仓库中其余 TypeScript 脚本运行；本地、hook 和 CI 优先通过 `bun run <script>` 使用稳定入口。最低兼容版本由 `package.json#engines.bun` 单独定义，环境入口从同一边界诊断 Bun，不在本文复制版本数值。
3. Node.js 负责运行 `@zxyycom/vibe-check` 的 Gate 入口及其原生测试；最低兼容版本由 `package.json#engines.node` 定义，`bun run check` 与 `bun run test:check` 仍是稳定的人工作业入口。
4. tsgo 负责类型检查；`typecheck` 使用固定版本的 `@typescript/native-preview`，对应 release-age 例外记录在 `pnpm-workspace.yaml`。
5. 常见格式、协议、解析和压缩能力优先使用成熟依赖；项目领域规则才由本仓库直接实现。

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

1. Git、满足 `package.json#engines.node` 的 Node.js、全局 CodeGraph 和 SCC 4.0.0 是前置条件；入口只诊断和复用它们，不安装或升级它们。函数指标使用 Vibe 随包分析器，不再要求 Lizard。
2. `check` 检查 Git、Node.js、Bun、pnpm、CodeGraph、SCC、索引状态、直接依赖、Git hook 和中央 task-graph root，不下载或修改环境。
3. `setup` 只会安装或切换 Bun、pnpm，运行 `pnpm install --frozen-lockfile`，调用已就绪的全局 CodeGraph 执行 `init` 和 `sync`，并配置当前 worktree；Git、Node.js、CodeGraph 或 SCC 缺失、版本不匹配或探测失败时会在任何安装前失败并给出恢复动作。
4. 恢复外部指标工具时，让精确 SCC 版本进入 `PATH`：`go install github.com/boyter/scc/v4@v4.0.0`。环境入口不替代类型检查、测试、生成漂移检查或完整仓库检查，也不由这些入口反向调用。

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
| `bun run publish:skills -- <rolling\|snapshot>` | 供发布 workflow 校验 `dist/` 制品并执行滚动发布或不可变快照事务；需要 GitHub Actions 提供的 `GH_TOKEN`、`GITHUB_SHA` 和 `PACKAGE_HASH` |
| `bun run setup-hooks` | 配置当前 worktree 的 `core.hooksPath`，并在 POSIX 文件系统恢复 hook 可执行权限 |
| `bun run setup-repository` | 配置当前 worktree hook，并确认当前项目的主 worktree 可作为默认 task-graph root |
| `bun run check [--diagnostic-log]` | 运行增量 base Gate：完整 Definition 的全部 63 个 Check 都会保留；35 个 base Check 只在当前有效输入没有精确成功 receipt 时以内部 flag 激活，28 个 release Check 保持 `not-applicable`。 |
| `bun run check --tag release [--baseline-ref <ref>] [--diagnostic-log]` | 运行 release Gate：在 base 基础上启用 release tag，执行全部 63 个 Check、版本验证与打包终结。省略基线时使用 `HEAD`，CI 使用事件基线。 |

### 权威 Vibe 门禁

`bun run check` 是唯一权威门禁入口。项目直接调用 Vibe `run`，不在 Vibe 外实现第二套 runner。责任边界如下：

| Owner | 责任 |
| --- | --- |
| Vibe | 根据 flags 和依赖完成 Check selection、scheduler admission、settlement 与 aggregate，并生成 progress 和 machine publication。 |
| 项目 Definition | 声明完整 Check catalog、原生 Check 配置、base impact contract、release DAG、资源 claims、learned strategy 与资源容量。 |
| 项目 impact layer | 从一次起始工作区快照派生标签和完整 Check 输入指纹，读取最近通过 receipt，并把需要执行的 base Check IDs 转成内部 activation flags；它不执行或结算 Check。 |
| 项目 CLI argument layer | 解析并校验仓库支持的参数，把规范化公开/内部 flags、输出路径和 aggregate policy 交给 Vibe，将 Vibe 最终结果映射为进程退出状态，并在成功后守护和发布 receipt。 |
| 项目 command adapter | 以参数数组执行 catalog 声明的 Bun/Node 命令，保存 transcript，并将进程终态映射为 Check result。 |

每次运行都构造 Check ID 相同的完整 Definition。本次 aggregate 用 `checks: "effective"` 复用 Vibe 的 flag 与依赖选择。无 tag 的 base Gate 先准备仓库领域 activation plan，再把需要执行的 Check 映射为内部 flags；release-only Check 仍由 release flag 控制。`--tag release` 不读取日常 receipt，直接激活并聚合全部 63 个 Check。未命中 flag 的 Check 不进入 preflight、扫描或命令启动，以 `not-applicable / flag-condition-not-matched`、`not run` 和 `duration: null` 保留在 Vibe machine snapshot，并由 progress 归组；复用项不冒充本次 passed，也不进入本次 aggregate。被 effective selection 纳入的 `unavailable` 或意外 `not-applicable` 一律 fail closed。

### Base impact 与通过证明

日常 Gate 的 impact layer 以以下闭合边界判断一项 Check 是否可以复用：

1. 每个起始快照恰好执行一次 `git ls-files --cached --others --exclude-standard -z`，对返回的普通文件各读取一次内容并记录 path、kind、mode、size 与 SHA-256；symlink 只记录链接文本，已删除 tracked path 记录为 missing。文件数超过 20,000、普通文件总量超过 512 MiB、Git 枚举失败、非 UTF-8 或越界路径、读取失败时不猜测部分结果，退化为执行全部 35 个 base Check。
2. 稳定路径规则为同一文件派生可重叠的 owner、`maintained-code`、`markdown`、`json`、`secret-surface` 与 `path-inventory` 标签。项目配置和 Gate 实现进入 `global`；无法分类的新路径也进入 `global`。`path-inventory` 只摘要 path/kind 和 symlink 目标，使 Markdown 目标增删或重定向传播，但普通非 Markdown 文件的内容变化不会无理由重跑链接检查。
3. 显式标签依赖把 `shared-tools` 传播给当前工具与 build-system consumer，把 `index-runtime` 传播给 Decision Records、Investigation Report 和 Test Evidence，把 `skill-release` 传播给 Environment、Skill Updater 与项目 validate consumer；build adapter 的变化再传播给使用它的生成一致性 Check。每个 base Check 的有效输入指纹由 Check ID、impact contract/version、直接与传递标签摘要以及下条定义的工具链身份共同形成；标签命中本身不构成跳过依据。
4. 工具链身份覆盖当前 Node 进程版本、平台和架构，Git 版本与完整配置，Bun 版本和 `bun pm ls --all` 报告的已安装依赖图，以及 ast-grep、Oxfmt、Oxlint、SCC、tsgo 的实际版本探测；任一必要探测失败时，当前快照不可用并全量执行，不能把 `unavailable` 固化为可复用身份。当前进程环境除 `_`、`OLDPWD`、`SHLVL` 这三个仓库不读取的父 shell 记账变量外全部进入摘要。原始 `node_modules` 字节不逐文件进入快照；这项证明依赖“依赖由 pnpm frozen lock 安装且不在包管理器外手工改写”的工作区前提，破坏该前提时先运行环境 setup，而不能把 receipt 当作依赖防篡改证明。
5. 只有该指纹精确命中 `.log/vibe-check/cache/incremental-gate-v2/receipts.json` 中格式合法且 outcome 为 passed 的最近证明时才复用。首次运行、缺项、损坏、指纹变化或未知路径带来的 `global` 变化都执行；consumer 激活时，其 `dependsOn` provider 即使已有跨运行证明也在本次重新执行，供 Vibe 形成真实 dependency outcome。
6. 只有 Vibe 返回 completed/passed，且本次实际执行项都 passed 时才重新取得结束快照；workspace/toolchain fingerprint 与起始值一致后，才把精确复用的旧证明与本次通过的新证明合并为当前 35 项 manifest 并原子替换。失败、取消、output failure、漂移、结束快照失败或 cache 写入失败不发布证明；cache 不可用只扩大执行，不改变质量结果。35 项全部复用时，CLI 只在确认 activation plan 完整覆盖 base catalog 后把空 effective aggregate 明确设为 passed；其他空选择继续 fail closed。

这些 receipt 是上述契约边界内的内容与环境证明，不按 branch、HEAD 或目录时间推断。普通 owner 目录没变而共享依赖、配置、工具链或声明环境变化时仍会失效；未知路径在首次稳定成功后可以由其 `global` 指纹复用，不会永久强制全跑。snapshot fallback 的消毒后原因同时进入终端计划摘要和 `gate-incremental.json`，便于修复输入边界。日常性能目标是稳定复用和普通 owner 变化低于 10 秒、共享或较重 owner 变化不超过 15 秒；release 不纳入该增量目标。

项目 CLI argument layer 只接受以下参数：

- `--tag release`：每次 invocation 最多出现一次。
- `--full`：等同 `--tag release` 的兼容别名，不能与该 tag 同用。
- `--baseline-ref <ref>`：只可与 release tag 同用；值必须是已 trim 的非空 revision 输入，且不得以 `-` 开头或包含 NUL、CR、LF。此层只校验输入形状；Git ref 的实际解析由 `release:skill-prepare` 完成。
- `--diagnostic-log`：每次 invocation 最多出现一次，只开启本次运行的 diagnostic channels。

未知 tag、缺失 tag 值、未知参数和重复参数在启动 Check 前以 usage 拒绝。

实现按责任放在以下模块：

| 路径 | Owner |
| --- | --- |
| `scripts/vibe-check.ts` | 项目 CLI argument layer、invocation 输出路径和退出状态映射。 |
| `scripts/lib/vibe-gate.ts` | 完整 Definition 的组合入口和既有项目内部导出。 |
| `scripts/lib/vibe-gate/checks/native.ts` | Vibe 内置 Check 的项目配置。 |
| `scripts/lib/vibe-gate/checks/package-script.ts` | 维护 package script Checks。 |
| `scripts/lib/vibe-gate/checks/semantic.ts` | 仓库语义测试 catalog。 |
| `scripts/lib/vibe-gate/checks/release.ts` | Release prepare、version authorization 与 packaging DAG。 |
| `scripts/lib/vibe-gate/impact.ts` | Git 可见文件快照、标签与传播、逐 Check impact contract、成功 receipt 和漂移保护。 |
| `scripts/lib/vibe-gate/command-runner.ts` | Vibe 尚未提供的任意 Bun/Node 命令执行、transcript 和进程终态映射。 |
| `scripts/lib/vibe-gate/diagnostics.ts` | 有界单行 Check messages 投影。 |
| `scripts/lib/vibe-gate/contracts.ts` | 共享 tag 与 named resource 契约。 |

| 术语 | 当前含义 |
| --- | --- |
| semantic Check | catalog 中以稳定 ID、显示名、release 条件（如需要）和直接命令定义的最小 Gate 单元。 |
| complete Definition | 每次 invocation 都包含相同的完整 Check ID 集合；tag 只改变 activation 与 aggregate selection，不删除声明。 |
| effective Check | 条件命中的 base/release Check，以及由 `propagateDependsOn` 带入的传递前置；只有它进入本次 aggregate。 |
| successful input proof | 本地 receipt 中与当前 Check 完整有效输入指纹精确一致的 passed 事实；只允许省略本次工作，不改写 Vibe outcome。 |
| release tag | 显式启用原 release-only 语义 Check、两个维护脚本、release snapshot、version 与 package DAG 的唯一 tag。 |
| release-required Check | release tag 下必须形成可信 passed 的普通 Check；全部通过后 release version authorization 才会开始。 |

所有 invocation 都使用 Vibe 原生 progress、`maxParallel: 4`、effective aggregate 和 learned critical-path prepared strategy。调用方拥有的可丢弃 history 位于 `.log/vibe-check/cache/scheduler-history/`；task identity 包含稳定 Task ID、base/release profile 和项目调度策略版本。首次、缺失、损坏或读写失败的 history 只让原生策略退化，不改变 Check membership、outcome 或 aggregate。独立 Check 即使其他无依赖 Check 已失败仍继续结算。

第一版 named resource 按任务性质声明，并以当前增量重运行测量修正容量：同时运行的外部进程最多 3 个，同时进行的全仓库扫描最多 2 个；命令型 package/semantic Check 消耗一个 `external-process`，原生内容分析消耗一个 `repository-scan`，SCC 文件指标与 release snapshot 同时消耗两类资源。资源从 Check admission 到 settlement 原子持有；它们只表达共享执行压力，不改变依赖、质量真值或 root 四槽上限。当前 shared-tools 增量中，外部容量 3 比 2 缩短关键路径，4 则因竞争反向变慢；后续只在任务性质或同类测量变化时调整。

每次 CLI invocation 创建唯一且被 Git 忽略的 `.log/vibe-check/invocations/<timestamp>-<uuid>/`：`machine/` 保存 Vibe 的 `run.json`、`records.ndjson` 和项目的 `gate-incremental.json`，后者记录 execute/reuse/fallback/first-run 计数、逐 Check reason、snapshot fallback detail 与 receipt 发布结果；`progress.log` 保存终端 progress 副本，`checks/<encoded-check-id>/process.log` 保存命令 Check 的完整 stdout/stderr transcript。终端在启动前显示同一组 activation 计数；失败仍先显示一条主消息，再把有界输出尾部拆成至多四条单行 message 并指向 transcript。单个 Vibe message 不嵌入换行，避免 progress renderer 将换行转义成字面 `\n`。该目录是本地可丢弃诊断状态，当前不自动清理；需要释放空间时可删除旧 invocation 目录。Diagnostic log 默认关闭；追加 `--diagnostic-log` 时只在本次目录的 `diagnostics/core.log` 与 `scheduler.log` 启用固定 channel 名并回显路径，不改变 machine publication。

Check catalog 以“它证明什么、失败后由谁处理”为分组条件：例如领域记录/索引、生命周期事务、按稳定 ID 的 pending-stage、调用协议和可分发制品可以是不同 Check；共同证明一个契约的多个原生测试文件保留在同一 Check。不得为均衡耗时把 Check 拆成每个测试，也不得把一个工具的全部测试重新合并为单一 Check。package scripts 继续是面向维护者的稳定手动聚合入口，但语义 Check 不再以 package script 身份作为 leaf。失败结果给出的直接命令是重跑该 Check 的权威路径；需要完整领域回归时仍可运行相应 `test:*` 聚合命令。


七项原生 Check 共用当前维护范围：代码类 Check 读取 Git worktree 中 `scripts/`、`tools/` 的 JavaScript/TypeScript，并排除 Vibe 默认排除项和 `docs/investigations/_resources/**`；JSON、Markdown 与 secret detection 也排除后者这类非当前维护内容。Markdown link validation 在 `.log/vibe-check/cache/markdown-parse-facts/` 启用原生 parse-facts cache；命中只复用解析事实，本次文件选择、目标判断、finding 和 outcome 仍重新形成，缓存不可用则 fresh-parse。Secret detection 只选择仓库维护的文本型扩展名、Git 属性/忽略文件与 hooks，以 4096 个文件和 64 MiB 总输入为 fail-closed 上限；高置信 PEM private-key finding、coverage gap 或 unavailable 都阻断。重复检测只把不少于 150 tokens 的重复片段作为 blocking finding，避免把已知的小型维护片段误作门禁失败。

release tag 同时验证工作区正确性与 release snapshot，但两者输入不能互相替代：普通 Check 在本次项目根 invocation 中结算，原生 Check 明确选择 Git worktree，脚本或直接测试命令由自身契约决定读取输入；`release:skill-prepare` 一次读取 Git `pending` 快照，默认 Git 实现将其映射到 index，随后 version authorization 与 `pack:skills` 只消费该 invocation-local 内存快照。因此 release Gate 通过不说明未暂存的工作树 skill 改动已进入制品；需要核对两者一致性时，分别检查工作树与 index。

| Check 类别 | 语义 |
| --- | --- |
| 结构与质量原生 Check | 重复、高置信私钥、JSON、Task Graph/Test Evidence Schema、Markdown 链接的 finding、coverage gap、unavailable 或意外 not-applicable 均阻断 aggregate。 |
| 文件指标与函数指标 | required advisory：可信 finding 保持 passed，progress 显示 warning 摘要；逐项 finding 保存在本次 invocation 的 `machine/records.ndjson`。函数指标将 `tools/` 产品源码设为严格区、`scripts/` 自动化设为中等区、测试设为宽松区，各区显式声明 NLOC、CCN、nesting depth 与参数阈值。unavailable 或意外 not-applicable 阻断；finding 数量和执行时长是测量输出，不是 catalog 边界。 |
| 语义 Check | adapter 以 catalog 声明的 `bun test` 或必要的 Node 原生命令运行精确测试入口。非零退出为 failed，不能启动、取消或无法形成可信退出结果为 unavailable；诊断提供同一命令以便直接重跑。 |
| 维护 package script Check | adapter 以参数数组运行 `bun run <script>`，保留既有稳定维护命令的行为验证；它不替代语义 Check。取消与后代进程回收边界仍由脚本协作处理。 |

函数指标区的普通上限依次为 NLOC、CCN、nesting depth、参数数：产品源码 `45/10/5/5`，自动化脚本 `80/16/8/7`，测试 `100/20/10/8`。低复杂度 NLOC allowance 分别为 CCN 严格低于 `5/7/8` 时允许到 `120/220/250`。三个区域当前都保持 non-blocking advisory；阈值差异用于把同一 measurement 转换为符合代码责任的维护信号，不以批量 waiver 隐藏现状。

三个消费当前工作树分发制品的 public-distribution semantic Check 必须先验证对应的唯一生成一致性 Check：

| public-distribution Check | 生成前置 | 稳定重跑入口 |
| --- | --- | --- |
| `test:change-plan:public-distribution` | `script:check:change-plan-cli` | `bun run check:change-plan-cli`、`bun run test:change-plan-cli` |
| `test:decision-records:public-distribution` | `script:check:decision-records-cli` | `bun run check:decision-records-cli`、`bun run test:decision-records-cli` |
| `test:task-graph:public-distribution` | `script:check:task-graph-cli` | `bun run check:task-graph-cli`、`bun run test:task-graph-cli` |

`dependsOn` 向 Vibe 声明成功前置：只有直接 provider 全部 `passed` 才进入 dependent callback；前置 failed 或 unavailable 时，Vibe 不启动 consumer，并结算为 `unavailable / dependency-not-passed`。项目 adapter 不重复读取或翻译 provider status；确需消费 provider final data 的 Check 才在 callback 内通过 `dependencies.get(...)` 做数据边界校验。此前置表达当前制品的信任边界，避免失败后的无效 consumer 输出并改善归因；它不减少成功路径中既有的单次生成/漂移检查，也不得据此宣称 happy-path 加速。

release tag 的 release DAG 固定为：

```text
release:skill-prepare（无普通前置，捕获 Git pending、pin baseline、分析版本）
          │ passed；保留内存 snapshot
          ├──────────────────────────────────────┐
          │                                      │
所有 release 普通 Check                              │
          │ 全部可信 passed                       │
          ▼                                      │
release:skill-version（授权 prepare 的同一快照） ◀┘
          │ passed
          ▼
pack:skills（恰好一次，从已授权的内存快照生成制品）
```

1. CLI 与 prepare preflight 只验证 authored `baselineRef` 的输入形状；它们不声称该 Git ref 存在或可解析。
2. `release:skill-prepare` 解析基线 revision，并一次捕获 pending snapshot、hash、版本与 version issues。捕获或解析失败为 unavailable；发现 version issue 仍完成 prepare。
3. `release:skill-version` 只在全部普通 prerequisite 及 prepare passed 后授权这份内存 snapshot；版本问题使 authorization failed。`pack:skills` 只在 authorization passed 后从该 snapshot 生成制品，不重新读取 Git index。`hash:skills` 仍是独立 CLI，pre-commit hook 仍独立以 `HEAD` 校验待提交版本。

当前锁文件解析 `@zxyycom/vibe-check@0.0.2`。重复检测直接使用随包 jscpd 5.1.x adapter；该版本已修复项目相对路径输入，因此项目不再保留 jscpd 适配脚本。函数指标使用随包 TypeScript analyzer，并增加 nesting-depth measurement，不再读取 PATH Lizard。`fileMetrics` 仍直接使用 PATH SCC，Vibe 原生 availability 精确检查 `scc version 4.0.0`；`node scripts/environment.js check` 精确报告缺失、版本不匹配或 probe failure，`setup` 不安装 SCC。CI 在同一 package job 固定安装并探测 SCC 4.0.0 后运行 release Gate。若锁文件解析的 Vibe 版本或 SCC 调用/输出契约改变，先复核这些边界。

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
bun run test-evidence -- tags
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
| Test Evidence | `test:test-evidence-cli`、`test:test-evidence-project` | `sync:test-evidence-cli`、`sync:test-evidence-catalog` | `check:test-evidence-cli`、`check:test-evidence-catalog` |
| Skill Updater | `test:skill-updater` | `sync:skill-updaters` | `check:skill-updaters` |
| MCPShell Workspace Bridge | `test:mcpshell-workspace-bridge` | `sync:mcpshell-workspace-bridge` | `check:mcpshell-workspace-bridge` |
| 共享基础设施 | `test:check`、`test:environment`、`test:generated-file`、`test:index-runtime`、`test:relation-graph`、`test:skill-package-hash`、`test:version-control` | — | — |

Vibe 的原生 `markdown-link-validation` Check 是当前维护 Markdown 链接的唯一全仓 owner；它沿用 blocking、fail-closed 和文件选择，并排除 `docs/investigations/_resources/**`。该目录是 Investigation Report 保存的形成时字节，仍由资源引用与完整性门禁维护。根 `bun run validate` 校验全部 skill 的结构和主仓库配置，不扫描链接。只有显式 `bun run validate-skill -- <skill-directory>` 才校验所指单个 skill 的内部链接。

三类前缀表达不同义务：

1. `test:*` 证明源码或分发模块的行为。
2. `sync:*` 是显式写入口，只在维护对应生成源时运行，不由完整检查自动写回。
3. `check:*` 只读验证仓库内容或生成产物；生成工具的 `sync:*` 与 `check:*` 必须使用同一构建路径。

只有具备独立维护操作、完整检查消费者或生成写入责任的命令才保留为 package script。`scripts/validators/project-config.ts` 检查这些稳定入口仍存在于 `package.json`。

### 工具 CLI 与 Git fixture 测试边界

`test:<tool>` 是工具行为与分发边界的稳定重跑入口；需要验证当前 Gate tag 集合时使用 `bun run check` 或 `bun run check --tag release`，不在维护说明中以测试文件路径替代这些 package scripts。

1. CLI 的参数组合、领域错误、文本/JSON 输出和退出结果在源码入口测试。入口可以接收局部 `argv`、工作目录和 stdout/stderr writer，但这些测试参数不建立新的公开 SDK。
2. 真实 Node smoke 只证明源码调用不能覆盖的分发边界：已安装/分发制品可启动、真实 argv 解析、stdout/stderr 分流、退出状态和模块解析。它不复制源码入口已经覆盖的参数矩阵。
3. 需要固定 Git 基线的测试在其测试 owner 下提交普通原始 fixture 文件树，而不是提交 `.git/`、bundle、可变工作区或绝对路径。启动 helper 复制该树到 case 私有目录，执行真实 `git init`、固定本地配置、`add` 和基线 `commit`；fixture 原始树是长期输入，helper 是唯一初始化路径。
4. 并行 case 不共享可变 Git 状态：只读查询可以复用只读模板；index、worktree、refs、config、lock 或恢复路径分别使用其隔离所需的私有状态。只有至少两个实际 consumer 共享同一初始化不变量时，才将最小 bootstrap helper 放入 `tools/shared/tests/`。

本仓库使用固定的 `docs/test-evidence/` 根目录、其中的 `cases/` 单 Case 文件和固定派生索引维护测试账本。账本覆盖 `test:*` 稳定入口保留的历史与当前测试；每个 Case 按同一测试意图承接一个或多个可独立选择、单独报告的最小原生测试节点。框架不限，本仓库当前沿用 `node:test` API 定义节点；普通测试通过固定版本的 `bun test` 执行，task-graph 原生 lock 集成测试通过其声明支持的 Node.js `--test` 执行。测试文件、package script 和完整检查仍只是聚合容器。

Case 使用 Tests、可选 tags、Contract 与 Proves，由测试改动显式维护；工具不扫描源码、自动登记 Case 或执行测试。核心 `check`、查询和 `sync-index` 只读取 Case 与索引；项目 `snapshot:test-evidence` 产生 schema v2 实体快照，引用检查必须同时接收独立的 expected source。`check:test-evidence-catalog` 先检查 Case/index，再计算当前项目测试来源 revision；若 `.log/vibe-check/cache/test-evidence-snapshots-v1/<revision>.json` 是通过 schema、expected source 与引用校验的完整 snapshot fact，则直接复用实体集合，否则重新生成并以同一 revision 发布可丢弃 cache。无论是否命中，Case 引用、实体覆盖和结束来源漂移都在本次重新判断。快照引用有效不等同于测试执行通过，未引用实体在通用核心中合法。正文变化后运行 `sync:test-evidence-catalog`；完整检查中的 `check:test-evidence-catalog` 不写回版本管理文件。

项目生产和旧账本迁移不属于 `bun run test-evidence` 的常规 Case CLI。需要人工检查或交接快照时，使用 `bun run snapshot:test-evidence -- --output <new-file>`；`migrate:test-evidence` 的 expected source 必须从生成快照所用的同一项目输入边界独立计算或核验，不能直接抄录待验证快照的 source 三字段。迁移命令默认只预演，只有明确追加 `--write` 才写入；支持范围、映射阻断和恢复边界由 [Case 账本契约](../skills/test-evidence-review/references/catalog-contract.md#迁移) 承接。日常查询、同步和检查不得把旧 topic/`Entry:` 当作 fallback 输入。

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
| `tools/mcpshell-workspace-bridge/` | `skills/mcpshell-workspace-tools/scripts/{init-mcpshell-workspace,mcpshell-workspace}.mjs`、关联 source maps 与 `references/mcpshell-tools.yaml` |

修改 `tools/shared/`、`tools/index-runtime/`、`tools/skill-package/` 或其他跨领域维护源码时，先按上表和实际导入关系定位受影响的领域 consumer；对每个受影响 consumer 依次运行对应全部 `sync:*`，再运行对应 `check:*`。共享目录不因没有独立分发目标而免于同步，也不因其共享身份无条件运行全部 `sync:*`。

Skill hash 和 zip 使用相同的版本管理 `pending` 快照，只覆盖最终进入 `skills/<skill-name>/` zip 的文件。默认 Git 实现把 `pending` 映射到 index，避免工作区覆盖和跨平台换行改变待提交制品。聚合 hash、zip 和 release 检测始终纳入每个包内文件的原始字节；这保证 source map、声明及其他制品字节改变都能得到不同的制品身份。每个 `SKILL.md` frontmatter 的 `metadata.version` 是手动维护的正整数字符串独立版本；版本门禁只对版本承载变化要求提升：`scripts/` 内由相邻 `.mjs` 的最后一个非空行以完整 `//# sourceMappingURL=<basename>` 指令链接的生成 `.mjs.map` 调试元数据编辑、新增或删除不承载版本，成对存在的 `.d.mts` 声明以根目录 `.oxfmtrc.json` 的配置规范化后比较，纯格式差异不承载版本；运行时 `.mjs`、声明语义、普通包内容以及声明的新增或删除仍承载版本，必须提升版本。

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

节流 ref 不属于 `main`，上述显式 push refspec 不会发布它。GitHub Actions 不能修改已经 push 的 commit；需要阻止错误提交进入 `main` 时，由 branch protection 或 ruleset 要求 CI check。

### 平台与 Git 环境

Hook 源文件通过 `.gitattributes` 固定使用 LF，并在 Git index 中保存为 `100755`。POSIX Git 会检查工作区执行位，因此 setup 对当前 worktree 的 `pre-commit` 和 `post-commit` 重新执行 `chmod 0755`；原生 Git for Windows 的 `access(X_OK)` 兼容层忽略 `X_OK`，因此 Windows setup 不把 `chmod` 当作启用机制，而是依赖 LF 脚本存在且 `core.hooksPath=.githooks`。环境测试使用真实 `git commit` 验证两类 hook 被调用，并以启用 checkout 换行转换的 clone 验证 LF 契约；当前完整门禁仍只在 Linux 运行，不能表述为已经完成真实 Windows runner 验证。

Git 调用 hook 时会注入当前 worktree 的 `GIT_DIR`、`GIT_INDEX_FILE` 等 repository-local 环境变量。两个 hook 在取得当前顶层路径后先清除 `git rev-parse --local-env-vars` 声明的变量，再从该顶层运行各自 helper；这样 nested Git 会重新识别当前 worktree、共享 common dir 及其正确 index，而不会继承 hook 调用点的局部覆盖。

## CI 与发布

`.github/workflows/package-skills.yml` 复用本地稳定入口：

1. 安装固定 Bun、Node、pnpm 和 Go，执行 `pnpm install --frozen-lockfile`。
2. 在同一 package job 安装 SCC 4.0.0，并在运行门禁前精确探测版本；函数指标无需额外分析器。
3. 运行 `bun run check --tag release --baseline-ref <event-baseline>`，在唯一 Gate aggregate 内完成前置检查、相对事件基线的独立版本校验和全部 skill 打包；workflow 遇空或全零事件基线时省略该参数，release Gate 因而回退 `HEAD`。
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
