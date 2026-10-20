# Design

采用包内自有 TS 模块、独立 pnpm 安装基线和正常模块解析，兑现源码可读、可改、可运行的结果。

## Context

维护源码、分发适配和正式内容分别由 `tools/`、`scripts/build/` 与 `skills/` 承接，
职责见[源码与依赖边界](../../docs/tooling.md#源码与依赖边界)。根 manifest 与锁文件服务主仓库开发；
skill 需要可独立使用的运行依赖清单。

本设计保存目标状态；实际生效契约仍由项目与各 skill 的行为 owner 承接，
实施进度和验证证据由 [tasks.md](tasks.md) 维护。

## Goals / Non-Goals

- 目标：直接交付自有 TS，使用标准依赖安装，支持兼容宿主复用，保持单一维护源码与领域接口语义。
- 范围边界：调整单 skill 的运行和交付形态；用户安装集合、客户端配置与领域业务规则由既有 owner 承接。

## Decisions

### Intended Change

#### 代码与入口

维护源码继续位于 `tools/`。将运行所需 TS、共享模块、资源和类型复制到
`scripts/runtime/tools/<tool>/...`，保留相对目录与模块关系，导入路径适配 TS 扩展名。
仓库维护从源码 owner 同步；安装者可直接修改包内副本，生成头区分这两种使用方式。

公开入口为 `scripts/<entry>.ts`，updater 为 `scripts/update-skill.ts`，调用方与文档同步采用 TS
路径，原 MJS 路径不在兼容范围内。稳定程序化边界继续由公开导出及必要类型定义，
Schema 和声明按实际消费契约生成。第三方包按其原生 JS/native 格式运行，由 pnpm 安装。

执行采用 Node.js 原生类型擦除；构造参数属性展开为显式字段与构造赋值，保留类型和初始化语义。
根 `tsconfig.json` 以 `erasableSyntaxOnly`、`verbatimModuleSyntax` 和 NodeNext 接入既有
`typecheck`。现成静态检查覆盖可擦除语法与模块类型约束；实际 Node 入口继续验证装饰器、TSX、
解析位置、资源与目标 API/native 能力，类型检查不代替运行验证。

#### 依赖与安装

每份 skill 提供完整运行依赖的 `package.json`、`pnpm-lock.yaml` 与 `.gitignore`。
Manifest 声明 ESM、Node engine、固定 `packageManager` 和运行/公开类型需要的依赖；
pnpm 精确版本沿用根 manifest。依赖声明可脱离仓库解析，不含 `workspace:` 或仓库外本地路径。

锁文件由维护者显式刷新，用于复现经过验证的安装基线。运行采用 Node 正常解析，允许兼容宿主依赖；
兼容性由支持版本范围和 API/行为契约定义，不以来源、本地依赖目录或锁文件精确版本增设门禁。
Node 本身不会按 manifest 范围挑选兼容版本。

标准独立安装命令：

```bash
pnpm --dir "<skill-directory>" install \
  --ignore-workspace --prod --frozen-lockfile \
  --config.node-linker=isolated
```

该命令独立管理本次安装，store 复用与链接由 pnpm 处理。`pnpm-workspace.yaml` 仅在具体依赖
确需项目级配置时添加，例如构建脚本许可或 overrides，并验证其与固定 pnpm 的配置行为。

#### 使用、更新与恢复

已有兼容依赖即可运行；依赖不可用、实际不兼容或需要复现基线时，显式执行 frozen 安装。
普通运行、import、help 和只读检查不隐式下载、执行安装脚本或修改全局配置；
实际加载/调用失败保留诊断并提供安装指引。

Updater 同样需要兼容依赖。依赖损坏时先通过 pnpm 重装或重新获取 skill 恢复，再执行更新。
知识型 skill 的指令使用无需安装，其 TS updater 按上述运行前置使用。

文件更新沿用 [Updater 的覆盖/保留契约](../../tools/skill-updater/README.md#运行契约)：
同名更新会覆盖包内定制，其他本地文件保留。源码更新状态与依赖兼容性分别说明。

### Resulting Impacts

1. 同步工具维护包内预期文件集合、可移植配置和必要生成内容；check 只读比较，sync 仅清理已知
   过期受管文件。公开调用方、主模块判断、模块位置、资源和动态 import 随 TS 路径调整。
2. TS、manifest、锁文件与按需配置进入制品身份并承载独立版本；制品显式排除依赖目录、store、
   安装链接和缓存，包括被强制加入 pending 的安装产物。Git 忽略与制品过滤分别验证。
3. Node engine、native runtime 和 optional 能力沿用领域 owner；TS updater 自更新需核对执行中
   模块加载及文件覆盖边界。纯 TS 路径调整之外的兼容性变化在实施前回到设计确认。
4. 根命令、Gate impact/生成前置与 CI 消费新的同步结果；Bun 继续承担主仓库维护调度和必要生成。
   业务矩阵由源码测试承担，生成契约与最小分发 smoke 证明交付边界，
   按现有 owner 同步行为文档、Case/index 和 Decision。

## Risks / Trade-offs

| 取舍 | 处理方式 |
| --- | --- |
| Node 原生类型擦除限制可用 TS 语法，且静态检查不覆盖全部运行条件。 | 使用现成编译选项提前诊断可擦除语法，再由真实 Node smoke 验证分发入口。 |
| 宿主依赖可能不同于维护基线。 | 验证兼容行为，保留 frozen 安装作为复现与恢复路径。 |
| TS updater 与多文件更新依赖可用环境，源码与依赖分步更新。 | 安装/更新期间暂停领域操作，失败后按明确步骤恢复。 |
| 独立锁文件、源码副本和局部安装布局增加维护与存储开销。 | 接受独立交付成本，复用 pnpm 能力并以同步检查和测试预算约束开销。 |

## Open Questions

无。若实施证据要求调整 Node engine、接口语义、native 责任或安装权限，先确认相应影响。

## Implementation Observations

### Readiness：入口与运行闭包

- 根环境当前为 Node 26.8.2、pnpm 11.7.0、Bun 1.4.2；根 manifest 的 Node 下限为
  `>=24.18`。Task Graph 自身继续拥有 `^22.22.2 || ^24.15.0 || >=26.0.0` 的 native engine
  契约，不能由根维护环境覆盖。最低支持版本与跨平台证据由后续验证分别说明。
- 维护源码保留在 `tools/`；公开 `scripts/<entry>.ts` 对应下表的旧 MJS basename，既有
  `package.json` 短命令、tool help、测试 support/consumer、MCPShell YAML 与 Task Graph
  项目定位 wrapper 是路径调整调用方。共享闭包仍由 `tools/shared/`、`tools/index-runtime/`
  与 `tools/skill-package/` 的实际 import 决定，不把整个共享目录无条件复制。

| 工具 | 源码公开入口 | 类型、Schema 与资源 | 外部运行依赖（含共享闭包） |
| --- | --- | --- | --- |
| Change Plan | `tools/change-plan/src/cli.ts` | 直接 TS import；不建立稳定 SDK/独立声明 | `mdast-util-from-markdown`、`mdast-util-to-string`、`simple-git`、`valibot` |
| Decision Records | `tools/decision-records/src/cli.ts` | 机械声明闭包；decision index Schema | `commander`、`simple-git`、`valibot`、`yaml`、`fast-glob` |
| Investigation Report | `tools/investigation-report/src/cli.ts` | `api/check-investigations.d.mts`；investigation index Schema | `commander`、`simple-git`、`neverthrow`、`valibot`、`fast-glob` |
| Test Evidence | `tools/test-evidence/src/cli.ts` | 手维护主声明、10 份 Schema 派生声明及对应 JSON Schema | `commander`、`simple-git`、`valibot`、`fast-glob` |
| Task Graph | `tools/task-graph/src/cli.ts` | 机械声明闭包与 task index Schema；保留 `stripInternal` 的公开边界 | `valibot`、`simple-git`、`write-file-atomic` |
| Skill Validator | `tools/skill-validator/src/cli.ts` | `api/validate-skill.d.mts`；无额外 Schema | `fast-glob`、`yaml`、`github-slugger`、`mdast-util-from-markdown`、`mdast-util-to-string` |
| Lightweight Judgment | `tools/lightweight-judgment/src/cli.ts` | 两份 SQL 迁移资源；无独立 SDK | `valibot`、`ts-pattern`，以及 Node 内置 sqlite |
| Novel Cards | `tools/novel-cards/src/cli.ts` | 无独立 SDK/Schema | `valibot`、`ts-pattern`、`yaml`、`simple-git` |
| MCPShell | `tools/mcpshell-workspace-bridge/src/{initializer,runtime}.ts` | `references/mcpshell-tools.yaml` 四条命令；无独立声明 | Node 标准库 |
| Updater | `tools/skill-updater/src/index.ts` | 每 skill 配置与公开入口位置 | `fflate`、`valibot`、`yaml` |

- Updater 自有闭包为 `skill-updater/src/{index,cli,installation,release,types}.ts`、
  `skill-package/src/{version,release-manifest}.ts`、`shared/src/markdown/frontmatter.ts` 与
  `shared/src/node/{filesystem,main-module}.ts`。其配置注入与公开 updater URL 必须由适配器显式
  提供；不能把深层 runtime URL 当成安装根。MCPShell 的 `skillDirectoryFromScriptUrl`
  同样需要保留公开入口定位事实。
- Task Graph 的 `fs-native-extensions@1.5.0` 仍是独立手工配置并经 probe 的 mutation runtime，
  不进入 skill 普通必需依赖。`supports-color` 是 `simple-git -> debug` 的可缺失增强；直接
  依赖解析沿用包自身 try/catch，不把它变为必装项。`neverthrow` 的 Rollup optional 包不构成
  业务 native 前置。其余工具与 updater 没有自有 native 扩展契约。
- 全仓 `scripts/`、`tools/` 编译检查定位到 8 文件、19 个构造参数属性：Investigation 的
  `markdown-frontmatter.ts`，Lightweight Judgment 的 `failure.ts`、`json.ts`、`call-log.ts`，
  Novel Cards 的 `source.ts`、`card.ts`、`query.ts`，以及共享 `option.ts`；均已展开并保留原语义。
  948 个非声明 TS/MTS 通过 Node strip 扫描，8 个改动模块通过真实 Node 导入与必要状态断言。
  负向 fixture 证明现成编译选项拒绝参数属性、enum、运行时 namespace/module、非 ECMAScript
  import/export 赋值与尖括号断言；装饰器和开启 JSX 的 TSX 可通过该选项，却不能在当前 Node
  直接执行，因此实际入口验证仍是独立义务。
- Task Graph 声明当前以 `--stripInternal` 隐藏 CLI runtime/store 注入。公开 TS 入口不能因
  直接 re-export 源码而改变该类型边界；Investigation/Validator/Test Evidence 继续保留必要
  手维护声明的 owner，不由源码搬移顺手重构 SDK。

### Readiness：活动 Change 与验证预算

- 其余活动计划涉及 Task Graph 的直接 SDK 入口、显式 ID、tags/find、纠错与继承；Novel Cards
  的写作流程与后续写作 skill。本轮试点不修改这些领域行为或它们的任务状态，后续传播前按其
  实际 HEAD/diff 再核对入口与声明。
- Change Plan 同步现在不执行 bundle，单次 ast-grep 子进程收集 import/export/type/literal
  dynamic AST 后复制闭包；领域与updater完整entries一次生成，使共享模块只出现一次。
  Change Plan原领域49个TS文件另有公开入口，联合updater后按实际闭包扩展；全24skill联合check热缓存约6秒。
- 原业务矩阵继续由源码节点覆盖。新增 smoke 仅证明 frozen 独立安装、独立类型消费者、实际
  Node CLI/import、兼容宿主不同版本且无本地依赖目录、包内改码无需构建、缺失依赖不隐式安装。
  六个通用分发节点合计9次显式pnpm命令、13次Node CLI/import和1次tsgo，不含工具内部派生进程。
  pnpm包含6次成功frozen、1次预期失败frozen、1次宿主安装与1次仅锁刷新；新增调用分别证明实际
  API不兼容恢复、独立多版本重装与锁失配恢复。六节点热缓存实测9.24秒，完整发布门禁的公开分发
  Check约15秒（包含其他CLI/metadata节点）；隔离运行完整Change Plan矩阵59节点为13.19秒，
  符合热缓存预算。每节点timeout为60秒，不向每个领域复制该矩阵。
- 预算：Change Plan 既有矩阵约 4 秒，含上述 smoke 目标热缓存不超过 15 秒、冷依赖下载不超过
  60 秒；单次生成检查不超过 1 秒。其他工具维持现有源码矩阵，仅为资源、多入口或 native
  边界增加无法由共享 smoke 证明的节点。发布门禁的 `--cold` 强制重跑测试证明，不代表清空pnpm
  store；一次性Node版本下载也不计入常驻测试预算。

### 领域推广验收观察

- 全部9个领域skill的隔离副本均以标准pnpm frozen命令实际安装，锁文件字节不变；使用已经安装的
  Node24.18.0执行公开CLI与无输出import，并由独立tsgo消费者直接import公开TS，全部通过。
  MCPShell额外执行正式公开initializer只读preview与运行helper缺配置envelope；TaskGraph额外检查
  类类型名和隐藏store/constructor/CLI注入。真实zip进一步在无祖先依赖的隔离目录完成全部9领域
  的frozen安装与运行；全部既有公开声明入口的strict、`skipLibCheck:false`独立类型消费者通过，
  编译器文件清单确认除标准库外不借用仓库业务、第三方依赖或Node类型。
- 通用负向矩阵已覆盖能解析但缺失API的宿主valibot，保留实际失败cause并给出frozen恢复命令，
  不隐式安装。显式本地frozen后恢复且宿主fixture不变；兼容mdast宿主2.0.3与锁2.1.0、无本地
  node_modules继续通过。两份独立frozen副本的valibot1.4.2/1.5.0可同时运行，重装一份不改另一份。
- 静态公开桥接只把同一运行导出绑定到既有声明，不重建对象/函数或转换数据。生成声明的unique-symbol
  品牌、私有成员名义身份与手维护readonly/字面量投影沿原owner；同名class同时显式导出类型别名，
  避免值导出遮蔽类类型。运行引用同一性与独立消费者共同验证该边界。
- MCPShell在共同安装忽略规则外保留唯一 `/.env.mcpshell`；正式分发的preview与Git ignore已独立
  复核。真实MCPShell executable和localhost OpenSSH环境仍未配置，两个既有可选集成节点跳过。
- TaskGraph在Node22.22.2的公开分发5节点与真实native lock4节点通过；Node24.18的native lock4节点
  也通过。Node24来自已有运行时，临时Node22和隔离安装目录均已清理，未改共享store/cache。
- 24个真实zip共1174文件逐字节匹配Git pending；版本与release manifest一致，运行时/入口为TS，
  声明、Schema、SQL、YAML完整且不包含安装产物。知识型updater无安装时的import、真实zip改码
  即生效、MCPShell只读preview与LJ SQLite均经真实Node验证。Windows与真实远端服务未新增验证。
