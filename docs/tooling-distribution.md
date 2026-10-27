# 源码生成与 Skill 分发

本文承接源码责任、生成同步和 Skill 制品身份；整体交付关系见[项目工具链](tooling.md)，发布操作见[交付操作](tooling-delivery.md)。

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
4. 确认聚合打包和自更新入口能够发现并覆盖该 skill，完成结构、生成一致性和适用仓库验收。打包输入、updater 与发布要求继续由本节和 [CI 与发布](tooling-delivery.md#ci-与发布)承接。

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

manifest 依赖变化后，使用固定 pnpm 显式刷新相应 skill 的锁文件：

```bash
pnpm --dir "<skill-directory>" install \
  --ignore-workspace --lockfile-only \
  --config.node-linker=isolated
```

同步检查只核对 manifest 与锁文件中的直接依赖声明一致；完整依赖解析可用性由独立 frozen 安装证明。`sync:skill-updaters` 与无参数 `check:skill-updaters` 覆盖全部 skill 的联合运行时，包括同时带领域工具的 skill。

只读检查支持 `bun run check:skill-updaters -- --skill <name> [--skill <name> ...]`，按所选 skill 的真实领域、updater 与共享模块闭包重建全部受管内容。选择在加载生成器前完整校验；未知或空名称失败。`--skill` 不用于同步写入。Gate 显式范围如何选择此闭包见[生成前置与发布快照](gate-execution.md#生成前置与发布快照)。

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
