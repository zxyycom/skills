# Proposal

本 change 计划审计本仓库已经建立的原生测试节点和历史 case，修正仍不符合自然 runner 粒度的实现，并在最终 topic 目录中建立完整对照；本文不改变测试证据工具的通用目录能力。

## Why

本仓库原有许多测试以普通脚本顺序调用多个 helper，命令最终只报告一个进程结果。当前基线已经把这些测试大面积转换为框架原生节点并建立 case，但尚需在最终 topic 布局下审计：转换是否只拆出了独立测试意图、历史入口是否完整、是否仍存在脚本或内部 helper 被误当成 case。

用户已经要求过往测试也进入账本，并允许使用 `node:test` 之外的常见框架，只要接入顺手、简单。审计需要把已经存在的测试改造与 topic 索引能力、目录迁移分开判断，确保保留的代码变化都服务于独立报告和历史证据登记，而不是为账本制造新测试。

## Outcome

- 每个保留的最小原生测试节点拥有稳定名称、可由当前 runner 独立报告结果，并恰好对应一个 case。
- 测试文件、suite、run 聚合器、package script 和 CI job 只作为容器，不登记聚合 case。
- 当前已经完成的框架转换逐组通过粒度、隔离和失败归因审计；不必要的拆分得到收敛，仍缺少原生边界的测试才继续改造。
- 本仓库实施起点前已经存在的历史测试全部完成范围审计、归属或明确排除。
- package test 命令和项目 check 执行真实测试 runner，并同时校验最终测试证据目录。

## Scope

纳入范围：

- `package.json` 中稳定 `test:*` 入口覆盖的当前测试文件、run 聚合器和测试命令。
- 当前 `node:test` 转换和任何必要的 `bun:test` 或其他仓库现有常见框架调整，以及测试名称和临时工作区隔离。
- 对应的 test-evidence case 创建、更新或删除，以及最终 topic 归属。
- 一次性历史测试清单、入口到 case 的人工对照和完整性验收。
- 项目 check 对测试 runner 退出状态与账本严格检查的编排。

不纳入范围：

- 新增与当前行为无关的覆盖率测试、重写产品实现或改变已有断言语义。
- 修改 topic 目录、主题表、索引 Schema 或可分发 test-evidence 工具；前置 changes 负责。
- 把 lint、typecheck、生成检查、打包检查或其他工程 gate 登记为 test case。
- 恢复源码 marker、自动采集、自动登记或长期维护一份测试入口 inventory。
- 强制全仓统一为同一个测试框架。

## Success Criteria

- 每个纳入范围的历史测试意图都能定位到 runner 报告中的一个最小原生节点，或有明确审计结论说明它只是容器、内部环节或非测试工程校验。
- 每个保留原生节点恰好对应一个 case，每个 case 的 Entry 只定位该节点；没有 tool、skill、文件、suite、脚本或 CI 聚合 case。
- runner 输出能够分别显示节点名称和失败归因，单个节点失败不会被登记为其他 case 的结果。
- 框架选择按现有运行环境最小接入，不为统一风格重写无关测试或改变 fixture 语义。
- 历史清单与最终 case 集合完成逐项审计，项目当前测试总入口没有未解释缺口。
- 目标测试、test-evidence 严格检查、类型检查和完整仓库检查通过。

## Affected Owners

- `tools/*/tests/`、`scripts/**/*.test.ts` 与各测试 run 入口：历史测试实现和原生节点。
- `package.json` 与 `scripts/lib/check-plan.ts`：稳定测试命令和项目检查编排。
- `docs/test-evidence/<topic-id>/*.md`：每个原生测试节点对应的显式 case。
- `skills/test-evidence-review/SKILL.md`：只作为入口粒度和证据评估 owner，不在本 change 重定义。
- 各被测工具的行为 owner 与测试支持文件：保持既有断言和 fixture 语义。

## Dependencies

本 change 必须在 `organize-test-evidence-by-topic` 和
`migrate-repository-test-evidence-to-topic-layout` 都完成后实施。前者提供可分发
目录与索引能力，后者提供本仓库最终 topic 表和迁移后的 case 基线；本 change
只审计、修正并补齐与真实原生测试节点对应的 case。
