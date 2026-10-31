# 稳定维护命令

本文承接项目稳定 package scripts 和日常维护入口；`package.json#scripts` 是实际命令清单。环境准备见[环境自举](tooling-environment.md)，Gate 范围和证明见 [Gate 执行](gate-execution.md)。

## 核心命令

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
| `bun run check [--diagnostic-log]` | 默认 quick：执行 [Catalog 与选择](gate-execution.md#catalog-与选择)列出的六项公共基线，强制快速性能预算；不采集全局指纹或读写 receipt，不代替代码质量与领域校验。 |
| `bun run check -- --scope <capability> [--scope <capability> ...]` | 公共基线加显式领域检查、按领域 `kind` 带入的质量检查及必要依赖；多领域独立求文件集合后取并集，重复去重。用 `bun run check -- --list-scopes` 查询实际能力名。按当前任务影响选择，不随其他工作区改动扩张。 |
| `bun run check:changed`（或 `bun run all`） | changed：自动判断完整 base 范围的变更相关验收，使用精确 receipt 与成功发布事务；用于影响范围不明或需要工作区整体兜底时。 |
| `bun run check --scope full` | 实际执行全部 66 项 base，不复用或发布 receipt；CI 的任意 base scope 均提升到 full。 |
| `bun run check --tag release [--baseline-ref <ref>] [--cold] [--diagnostic-log]` | 运行完整 69 项 release Gate，不采集、读取或发布项目 receipt；环境前置通过后实际执行普通检查，再完成版本授权与打包。省略基线时使用 `HEAD`，CI 使用事件基线；`--cold` 明确表达全执行意图。 |

`typecheck` 从根 `tsconfig.json` 的 include 开始检查，并沿 import 检查传递可达的 skill TS/MTS 与声明；涉及模块解析的 skill manifest 也属于输入。它证明当前 TypeScript program 类型有效，源码与生成物一致性由统一生成检查另证。type-aware `lint` 同样保守纳入该程序输入；`format` 保持自身独立范围。

显式选择 `kind: code` 领域会运行完整现有输入上的 `typecheck`、`lint` 与 `format:check`，并将原生文件/函数指标收窄到所选代码领域的维护代码投影；`declarations` 领域只带入三个质量命令，不启动指标；`material` 领域只选择其领域检查及必要前置。类别由 owner [显式声明](gate-check-authoring.md#领域范围与检查订阅)，不由当前磁盘是否存在代码判断。重复检测仍由 `repository-code` 订阅选中并读取完整维护代码。`validate` 通过 `repository-validation` 或 `skill-validator` scope 选中；上述四个命令均不属于默认 quick。基础环境前置仍按[环境自举](tooling-environment.md#环境自举)执行，不因 quick 不运行指标而免除 SCC 要求。

根 `tsconfig.json` 启用编译器原生 incremental，build info 位于 `.log/vibe-check/cache/typecheck/tsconfig.tsbuildinfo`。命令仍为 `tsgo --noEmit`，每次调用都按当前完整 include 与质量选项结算诊断；编译事实可丢弃并重建，不作为项目成功 receipt 或缩小检查范围的依据。

## 仓库维护短命令

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

## 工具维护命令

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
