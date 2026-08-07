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
2. Bun 负责 package scripts 调度和 TypeScript 脚本运行；本地、hook 和 CI 优先通过 `bun run <script>` 使用稳定入口。
3. tsgo 负责类型检查；`typecheck` 使用固定版本的 `@typescript/native-preview`，对应 release-age 例外记录在 `pnpm-workspace.yaml`。
4. 常见格式、协议、解析和压缩能力优先使用成熟依赖；项目领域规则才由本仓库直接实现。

## 环境自举

`scripts/env.js` 是进入项目工具链前的跨平台独立入口，只使用 Node.js 标准库，不依赖 Bun、pnpm、项目包或 `bun run check`。

只读检查环境：

```bash
node scripts/env.js check
```

补齐 Bun、pnpm 和锁定依赖：

```bash
node scripts/env.js install
```

环境入口遵守以下边界：

1. Git、Node.js 和全局 CodeGraph 是前置条件，入口只诊断缺失，不安装或升级它们。
2. `check` 检查 Git、Node.js、Bun、pnpm、CodeGraph、索引状态和直接依赖，不下载或修改环境。
3. `install` 可以安装或切换 Bun、pnpm，运行 `pnpm install --frozen-lockfile`，并调用全局 CodeGraph 执行 `init` 和 `sync`；它不使用系统包管理器，也不提升权限。
4. 环境自举不替代类型检查、测试、生成漂移检查或完整仓库检查，也不由这些入口反向调用。

Codex 工作区在 `.codex/environments/` 提供两个入口：

1. `skills` 保留工作区内容并运行 `node scripts/env.js install`。
2. `clear` 先丢弃已跟踪改动和未跟踪文件，再运行同一安装入口；只在明确需要干净工作区时使用。

`.codex/config.toml` 通过全局 `codegraph serve --mcp` 启动代码图服务。`.codegraph/` 只提交维持忽略规则的 `.gitignore`，本机索引数据库不进入版本控制。

## Package scripts

`package.json#scripts` 是命令名称与实际入口的唯一清单。本节只解释稳定命令和命令族，不复制每个测试的内部覆盖项。

### 核心命令

| 命令 | 责任 |
| --- | --- |
| `bun run typecheck` | 使用根目录 `tsconfig.json` 对 `scripts/`、`tools/` 和声明源执行 `tsgo --noEmit` |
| `bun run validate` | 校验全部 skill 入口、当前维护的仓库 Markdown 链接和主仓库配置 |
| `bun run hash:skills` | 从 Git `pending` 快照临时计算 package hash，并校验内容变化的 skill 已相对 `--baseline-ref` 提升 `SKILL.md` 中的 `metadata.version` |
| `bun run pack:skills` | 从版本管理 `pending` 快照生成每个 skill 的 zip 和 release manifest |
| `bun run setup-hooks` | 将当前仓库 `core.hooksPath` 设置为 `.githooks` |
| `bun run check` | 使用 quick 档运行必要快速检查，显式跳过 full 档耗时检查，并在已选检查通过后打包 |
| `bun run check --full` | 运行 quick 与 full 的全部检查并打包；CI 使用这一完整门禁 |

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
| 共享基础设施 | `test:check`、`test:generated-file`、`test:index-runtime`、`test:skill-package-hash`、`test:version-control` | — | — |

`bun run validate` 的主仓库 Markdown 链接范围排除 `changes/archive/**`。归档 change 只作为历史参考，仍由 change-plan CLI 保留结构、完成任务和归档目标门禁；active change 与其他当前维护文档继续参与链接校验。

三类前缀表达不同义务：

1. `test:*` 证明源码或分发模块的行为。
2. `sync:*` 是显式写入口，只在维护对应生成源时运行，不由完整检查自动写回。
3. `check:*` 只读验证仓库内容或生成产物；生成工具的 `sync:*` 与 `check:*` 必须使用同一构建路径。

只有具备独立维护操作、完整检查消费者或生成写入责任的命令才保留为 package script。`scripts/validators/project-config.ts` 检查这些稳定入口仍存在于 `package.json`。

本仓库使用固定的 `docs/test-evidence/` 根目录、其中的受控 topic 表、
每个 `<topic>/<slug>.md` 单 case 文件和固定派生索引维护测试账本。账本覆盖
`test:*` 稳定入口保留的历史与当前测试；一个 case 对应测试框架能够独立选择并
单独报告的一个最小原生测试节点。框架不限，本仓库当前沿用 `node:test` API 定义
节点，并通过已固定版本的 `bun test` 执行；这只是现有依赖下的简单选择。测试文件、
package script 和完整检查仍只是聚合容器。topic 表与 case 由测试改动显式维护，
工具只读取固定根目录中的合法 topic 和 case，不扫描测试源码、自动收集或注册 case。
正文变化后运行 `sync:test-evidence-catalog`；`check:test-evidence-catalog` 已进入
完整检查并只校验显式 topic 根目录与统一索引。

### 分档检查

本节是 `bun run check` 档位、输出、失败和打包行为的 owner。
`scripts/lib/check-plan.ts` 实现当前任务映射与调度顺序，`scripts/check.ts` 解析调用边界并执行计划；代码和测试不另行定义行为规则。

#### 档位与任务范围

每个前置任务声明一个最低档位。`full` 包含 `quick`，因此同一任务不会在 full 档重复执行。

| 任务最低档位 | `bun run check` | `bun run check --full` |
| --- | --- | --- |
| `quick` | 执行 | 执行 |
| `full` | 不执行，并逐项报告 `skipped` | 执行 |

当前只有以下耗时集成测试使用 `full` 最低档位；检查计划中的其他前置任务使用 `quick`：

| full-only 脚本 | 成本边界 |
| --- | --- |
| `test:decision-records-cli` | 覆盖大量生命周期、关系和 Git 事务场景 |
| `test:version-control` | 覆盖多个临时 Git 仓库与失败恢复场景 |
| `test:skill-package-hash` | 覆盖 Git 基线、pending 内容和独立版本门禁 |
| `test:investigation-report-check` | 覆盖分发一致性、索引查询和规模场景 |
| `test:test-evidence-cli` | 覆盖目录迁移、索引恢复和分发接口场景 |
| `test:task-graph-cli` | 覆盖图语义、native runtime、JSON 事务、跨进程互斥、租约恢复和分发场景 |

调整任务档位时，同步本节、`scripts/lib/check-plan.ts` 和对应测试。`pack:skills` 不属于前置任务档位；它只在本次选中的全部前置任务通过后执行。

#### 输出与失败

1. 成功任务默认只输出名称、`passed` 和耗时。使用 `--verbose` 时，任务完成后在该摘要前展开它捕获的 stdout 与 stderr。
2. 失败任务无论是否启用 `--verbose` 都完整展开自身捕获日志并输出 `failed`；该失败不会停止其余已选前置任务。
3. quick 档未选择的 full 任务逐项输出 `skipped`。前置任务失败时，`pack:skills` 也输出 `skipped`，但不会执行。
4. 最终摘要报告 profile、全部计划项与打包组成的 total checks，以及 passed、skipped、failed 和总耗时。quick 档只有 full-only 跳过且其余任务通过时，最终状态为 `passed`；任一已选任务或打包失败时，最终状态为 `failed`，命令退出 `1`。
5. 正常人类报告与捕获日志写入 stdout；任务启动前的参数或并发配置错误写入 stderr，并在不启动检查的情况下退出 `1`。

#### 调度与打包

1. 已选前置任务默认最多并发两个，可用 `CHECK_CONCURRENCY=<正整数>` 调整；该环境变量不改变任务档位，也不并发执行 `pack:skills`。
2. full-only 长任务在计划中优先领取，以减少保守并发下的尾部等待。
3. 全部已选前置任务完成后，只要其中一项失败就跳过打包；全部通过时运行一次 `pack:skills`，并把打包结果计入最终摘要。

## 源码与依赖边界

1. `scripts/` 只承接主仓库命令编排、构建适配、校验、打包、Git 和 CI 自动化。
2. 顶层脚本只保留入口与编排；`scripts/build/` 承接生成适配，`scripts/lib/` 承接跨脚本共享能力，`scripts/validators/` 承接项目校验项。
3. `tools/<tool-name>/src/` 承接需要构建后随 skill 分发的运行时源码，`api/` 承接公共声明源，`tests/` 承接源码、分发模块和 fixture 验证。
4. `tools/shared/` 只承接多个工具已经真实共享的运行时不变量；[版本管理中间层](../tools/shared/version-control.md) 是当前共享组件之一。
5. `tools/skill-package/` 承接 skill 版本以及发布端与 updater 共用的 release manifest 协议；仓库专用的临时 package hash 留在 `scripts/lib/`。[Index Runtime](../tools/index-runtime/README.md) 承接已经建立的跨领域派生索引协议。
6. 领域工具可以依赖自身源码、`tools/shared/`、`tools/skill-package/`、明确建立的跨领域协议、目标运行时和显式外部依赖；不能依赖 `scripts/`、`skills/`、`dist/` 或另一个领域工具。
7. 根目录 `tsconfig.json` 统一提供 IDE 与类型检查配置；仓库源码运行、构建和测试由 Bun 负责。Task-graph 分发 CLI 是明确例外，受支持执行器为其 skill frontmatter 与 help 公布的固定 Node.js engine。
8. 外部 JSON 在边界做运行时收窄。同一结构被多个入口消费或需要稳定字段诊断时，以 Valibot Schema 为结构真源；跨语言契约从同一 Schema 生成 JSON Schema 和分发声明。
9. 校验器检查长期源文件、链接和项目约束，不解析或正则匹配 GitHub Actions workflow 内部结构；workflow 行为由代码审查和实际运行验证。

实现代码的归属、边界处理、类型表达和风险验证继续遵循 [编码规范](coding-style.md)。

## 生成与分发

可分发工具统一遵守：

1. TypeScript 源码和声明源位于 `tools/`，读取仓库配置并写入 skill 的适配器位于 `scripts/build/`。
2. `sync:*` 生成自包含单文件 ESM `.mjs`、同名 `.d.mts` 和 linked source map；需要机器契约时同时生成 JSON Schema 和 Schema 派生声明。
3. 生成模块可被导入而不执行 CLI、修改退出状态或产生文件和网络副作用；只有作为主模块运行时进入 CLI。
4. 分发产物只能依赖目标运行时和包内内容。共享源码由构建器内联，不形成跨 skill 运行时前置。Task-graph 的包内 ESM 保持自包含；mutation 另行加载调用方按该 skill 指引配置、并由 CLI 探测的 native runtime 扩展。该扩展不属于 skill 制品，也不改变通用 updater 或其他工具的分发边界。
5. 可嵌入注释的生成产物必须写明禁止直接编辑、仓库与维护源码、skill 源目录和重建命令；生成头不写时间戳或本机绝对路径。
6. `check:*` 在临时目录重建并逐字节比较产物。`pack:skills` 不临时构建，只收集已经进入版本管理 `pending` 快照的 `skills/<skill-name>/` 稳定分发输入。

当前映射：

| 维护源码 | 分发目标 |
| --- | --- |
| `tools/change-plan/` | `skills/change-plan/scripts/change-plan.*` |
| `tools/decision-records/` | `skills/decision-records/scripts/decision-records.*` 和索引 Schema |
| `tools/investigation-report/` | `skills/investigation-report/scripts/check-investigations.*` 和索引 Schema |
| `tools/task-graph/` | `skills/task-graph/scripts/task-graph.*` 和 task index Schema |
| `tools/skill-validator/` | `skills/skill-maintainer/scripts/validate-skill.*` |
| `tools/test-evidence/` | `skills/test-evidence-review/scripts/` 与 `references/schemas/` 中的生成产物 |
| `tools/skill-updater/` | 每个 skill 的 `scripts/update-skill.*`；具体契约见 [Skill Updater](../tools/skill-updater/README.md) |
| `tools/index-runtime/` | 不独立分发，由当前领域构建器内联到对应自包含模块 |

Skill hash 和 zip 使用相同的版本管理 `pending` 快照，只覆盖最终进入 `skills/<skill-name>/` zip 的文件。默认 Git 实现把 `pending` 映射到 index，避免工作区覆盖和跨平台换行改变待提交制品。每个 `SKILL.md` frontmatter 的 `metadata.version` 是手动维护的正整数字符串独立版本；打包内容变化时必须提升版本。

`hash:skills` 只在本次命令运行期间计算全部 skill 的聚合 hash，不把 hash 或 lock 写入仓库。它将 Git `pending` 快照中发生变化的 skill 与指定 Git 基线 `SKILL.md` 中的 `metadata.version` 比较；本地 hook 默认使用 `HEAD`，CI 通过 `--baseline-ref <ref>` 传入事件基线。hash 用于标识本次制品，既不是 updater 输入，也不是长期状态。

`pack:skills` 每次先清空 `dist/`，再分别生成 `dist/<skill-name>.zip` 和只包含独立版本的 `dist/skill-release-manifest.json`。项目文档、`tools/`、`scripts/`、CI 和仓库元数据不进入 zip；只有这些内容同步为 skill 内生成产物后，才会改变对应 skill hash。

## Git hook

新 clone 或 hooksPath 丢失时运行：

```bash
bun run setup-hooks
```

`.githooks/pre-commit` 通过 `hash:skills --quiet` 只读检查 Git index；包内容变化但对应 `metadata.version` 未提升时命令失败。hook 不写文件，也不自动 stage。GitHub Actions 不能修改已经 push 的提交，需要阻止错误提交进入 `main` 时，应由 branch protection 或 ruleset 要求 CI check。

## CI 与发布

`.github/workflows/package-skills.yml` 复用本地稳定入口：

1. 安装固定 Bun 和 pnpm，执行 `pnpm install --frozen-lockfile`。
2. 运行 `bun run check --full`，完成门禁和全部 skill 打包。
3. 运行 `bun run hash:skills --github-output --baseline-ref <event-baseline>`，校验独立版本并输出本次聚合 hash。
4. 上传全部 `dist/*` 作为 workflow artifact。
5. `main` push 的 skill 打包内容变化或手动触发时，发布版本化 release，并更新 `skills-latest` 的 tag 与完整资产集。

版本化 tag 使用 UTC 时间戳和聚合 hash 前 12 位：`<timestamp>-<hash12>`。版本化 release 是真实发布记录并标记为 Latest；固定 `skills-latest` 只提供兼容下载入口，不承接发布时间语义。

PR 只校验、打包和上传 artifact。只改项目文档、`tools/` 源码、`scripts/` 或 CI 且未改变 skill 内分发产物时，skill hash 不变，不创建新版本化 release，也不覆盖 `skills-latest`。
