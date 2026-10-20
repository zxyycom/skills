# Gate 声明与去留清单

本表承接 68 个基线身份的质量义务、重跑入口与目标映射。
基线为提交 `7bd8a96754ef9226ee369a6a1d9dd364183d3370`：
环境 1、原生 7、package-script 28、语义 29、release 3。

## 处置标准

按独立验收结果、真实输入、失败 owner 和重跑边界判断保留或归并，
接入遵循 design 的[必要性标准](design.md#最小基线与特殊结构的必要性)。
先按类别读取全部基线义务，再按目标映射实施。

## 环境与原生：8 项

环境每次执行并作为其余结果的成功前置，重跑为 `node scripts/environment.js gate`；
七项原生结果迁移构造声明与文件选择，维持当前质量政策。

| 当前身份 | 质量义务 |
| --- | --- |
| `gate-environment` | 基础工具链与运行环境 |
| `duplicate-detection` | 重复片段，150-token blocking 边界 |
| `secret-detection` | 高置信 PEM private key 与扫描安全上限 |
| `json-validation` | 受管 JSON 语法、重复键、解码及输入可用性 |
| `json-schema-validation` | 显式实例与 Schema 的形状关系 |
| `markdown-link-validation` | 本地目标及锚点完整性 |
| `file-metrics` | 文件级体量与密度 |
| `function-metrics` | 函数体量、CCN、嵌套及参数，按现行区域阈值 |

## Package-script：28 项

重跑规则：去掉 ID 的 `script:` 前缀，以 `bun run <script-name>` 执行。
下表记录现有义务；八项领域生成检查归并到统一前置，其余项目结果独立结算。
Gate 自测随结构变化保留项目 consumer 契约。

| 当前身份 | 质量义务 |
| --- | --- |
| `script:test:environment` | 自举、hook 与环境配置行为 |
| `script:test:index-runtime` | 共享索引运行时 |
| `script:test:check` | Gate 接线、选择与失败闭合 |
| `script:test:skill-updater` | updater 实际行为与分发输入 |
| `script:test:skill-validator` | 可分发 validator 行为 |
| `script:test:relation-graph` | 共享关系图契约 |
| `script:test:file-text-search` | 共享文本搜索契约 |
| `script:test:version-control` | Git/version-control 行为及独立资源边界 |
| `script:test:skill-package-hash` | 版本承载、pending 与包身份 |
| `script:test:skill-release-publisher` | 发布事务回归 |
| `script:typecheck` | 跨模块类型关系 |
| `script:lint` | 代码规则与静态分析 |
| `script:validate` | skill 结构、必需文件、项目配置及版本格式 |
| `script:check:investigations` | 报告及派生索引的领域一致性 |
| `script:check:decisions` | 决策、关系及派生索引的领域一致性 |
| `script:check:test-evidence-cli` | Test Evidence 源码/分发一致性 |
| `script:check:test-evidence-catalog` | Case 引用、测试覆盖与来源漂移 |
| `script:check:skill-validator` | Skill Validator 源码/分发一致性 |
| `script:check:investigation-report-check` | Investigation Report 源码/分发一致性 |
| `script:check:change-plan-cli` | Change Plan 源码/分发一致性 |
| `script:check:lightweight-judgment-cli` | Lightweight Judgment 源码/分发一致性 |
| `script:check:novel-cards-cli` | Novel Cards 源码/分发一致性 |
| `script:check:decision-records-cli` | Decision Records 源码/分发一致性 |
| `script:check:task-graph-cli` | Task Graph 源码/分发一致性 |
| `script:check:skill-updaters` | 全部 skill runtime（含领域工具与 updater）的源码/分发一致性 |
| `script:test:generated-file` | 当前同步/生成基础契约 |
| `script:format:check` | 代码格式 |
| `script:check:task-graph-index` | 当前任务图状态的领域约束 |

## 语义结果：29 项

默认重跑：`test:<tool>:<case>` 对应 `bun test ./tools/<tool>/tests/checks/<case>.ts`，
例外列在表后。兼容性聚合入口未重复列入这些语义叶子。

| 当前身份 | 质量义务 |
| --- | --- |
| `test:novel-cards:card-and-query-contract` | 卡片完整性、独立查询与分发输入 |
| `test:lightweight-judgment:request-and-response` | 请求/响应边界 |
| `test:lightweight-judgment:public-distribution` | 独立分发与公开调用 |
| `test:change-plan:artifact-and-active-plan-gates` | Change 结构及活动成员边界 |
| `test:change-plan:lifecycle-finalize` | Plan 生命周期及安全 finalize |
| `test:change-plan:public-distribution` | 公开 CLI/分发 |
| `test:decision-records:record-and-established-graph` | 记录及已建立关系图 |
| `test:decision-records:query-and-index-projection` | 查询与索引投影 |
| `test:decision-records:lifecycle-and-recovery` | 生命周期与恢复 |
| `test:decision-records:pending-stage` | pending-stage 事务 |
| `test:decision-records:public-distribution` | 公开 CLI/分发 |
| `test:investigation-report:collection-and-resources` | 报告集合与资源 |
| `test:investigation-report:index-and-query` | 索引与查询 |
| `test:investigation-report:transactional-maintenance` | 维护事务 |
| `test:investigation-report:pending-stage` | pending-stage 事务 |
| `test:investigation-report:cli-contract` | CLI 调用契约 |
| `test:task-graph:index-and-projection` | 任务索引与投影 |
| `test:task-graph:task-lifecycle` | 任务生命周期 |
| `test:task-graph:runtime-and-store` | runtime/store |
| `test:task-graph:native-store` | Node native store，保持 Node runner |
| `test:task-graph:cli-rendering` | CLI 呈现 |
| `test:task-graph:pending-stage` | pending-stage 事务 |
| `test:task-graph:public-distribution` | 公开 CLI/分发 |
| `test:task-graph:portable-build` | 当前可移植分发契约 |
| `test:test-evidence:case-runtime` | Case 核心运行时 |
| `test:test-evidence:public-boundary` | 公开 API/CLI |
| `test:test-evidence:project-snapshot` | 项目测试快照生产者 |
| `test:test-evidence:project-reference-check` | 项目引用/覆盖消费者 |
| `test:test-evidence:migration` | 当前支持的迁移命令行为 |

默认路径的例外：

- Decision Records pending-stage：`bun test ./tools/decision-records/tests/stage.test.ts`。
- Task Graph native-store：`node --test ./tools/task-graph/tests/native-store.test.ts`；
  pending-stage：`bun test ./tools/task-graph/tests/staging.test.ts`；
  portable-build：`bun test ./tools/task-graph/tests/portable-build.test.ts`。
- Test Evidence case-runtime/public-boundary：分别为
  `bun test ./tools/test-evidence/tests/core.test.ts`、
  `bun test ./tools/test-evidence/tests/public-boundary.test.ts`。
- Test Evidence project-snapshot/project-reference-check/migration：分别为
  `bun test ./scripts/test-evidence/snapshot.test.ts`、
  `bun test ./scripts/test-evidence/check.test.ts`、`bun test ./scripts/test-evidence/migrate.test.ts`。

## Release：3 项

重跑为 `bun run check --tag release --cold`。基线 base 范围为 65 项（含环境），release 为全部 68 项；
三项 release 的授权和交付责任保持独立。

| 当前身份 | 质量义务与计划接线 |
| --- | --- |
| `release:skill-prepare` | 一次捕获 pending snapshot，环境之后准备 typed handoff |
| `release:skill-version` | required Checks 成功后，直接读取并授权同一 snapshot |
| `pack:skills` | 从 authorization provider 取得同一 snapshot 并打包 |

## 目标身份映射

实施 1.6 按以下后继接入：

- 八项旧身份均归并到 `script:check:skill-updaters`：
  `script:check:test-evidence-cli`、`script:check:skill-validator`、
  `script:check:investigation-report-check`、`script:check:change-plan-cli`、
  `script:check:lightweight-judgment-cli`、`script:check:novel-cards-cli`、
  `script:check:decision-records-cli`、`script:check:task-graph-cli`。
- 依据：统一注册表按相同 mode 调用相同 syncRuntime，完整覆盖同一批 artifacts，
  见[生成证据](upgrade-evidence.md#生成与外围入口)。领域手动命令、适配器和回归测试保留。
- 其余 60 个旧身份保留质量结果，新增四项如下。目标共 64 项：环境 1、原生 8、包脚本 20、语义 32、release 3；
  base 选择范围为 61 项（含环境），release 为全部 64 项。测试证据继续由 Case owner 维护。

| 新身份 | 独立结果与接入 |
| --- | --- |
| `markdown-lint` | 六规则内容缺陷；按设计的维护范围运行原生 Check。 |
| `test:mcpshell:initializer` | 初始化预演、配置和保留边界；`bun test ./tools/mcpshell-workspace-bridge/tests/initializer.test.ts`。 |
| `test:mcpshell:runtime` | shell/apply-patch/get/put 的工作区访问与结果契约；`bun test ./tools/mcpshell-workspace-bridge/tests/runtime.test.ts`。 |
| `test:mcpshell:public-distribution` | 真实分发入口、导入副作用与配置诊断；`bun test ./tools/mcpshell-workspace-bridge/tests/generated.test.ts`。 |

## 生成成功前置

所有结果继续依赖 `gate-environment`。下列分发结果改用 `script:check:skill-updaters` 作为统一生成前置：

| 消费结果 | 当前前置 | 计划前置 |
| --- | --- | --- |
| `test:change-plan:public-distribution` | `script:check:change-plan-cli` | `script:check:skill-updaters` |
| `test:decision-records:public-distribution` | `script:check:decision-records-cli` | `script:check:skill-updaters` |
| `test:task-graph:public-distribution` | `script:check:task-graph-cli` | `script:check:skill-updaters` |
| `test:lightweight-judgment:public-distribution` | `script:check:lightweight-judgment-cli` | `script:check:skill-updaters` |
| `test:novel-cards:card-and-query-contract` | `script:check:novel-cards-cli` | `script:check:skill-updaters` |
| `script:test:skill-updater` | `script:check:skill-updaters` | `script:check:skill-updaters` |

新增 MCPShell public-distribution 同样依赖统一生成前置。consumer 激活时通过原生依赖传播执行 provider。
统一前置失败会保守阻断分发消费者，原 artifact 路径与 rebuild 命令继续定位领域。

## 专用入口

- `check:mcpshell-workspace-bridge` 由统一生成注册表覆盖。
- MCPShell/localhost-SSH 真实集成保留显式环境入口。
- `test:index-runtime-performance` 保留按需回归；当前未声明持续 SLO。

各入口依据见[外围证据](upgrade-evidence.md#生成与外围入口)。
Tests/Contract/Proves 与最小原生测试节点由测试证据账本维护，本表只承接 Gate 身份与接入。
