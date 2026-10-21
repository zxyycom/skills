# 验收证据

本文记录本轮实际验证；逐项旧入口、最终入口、保留观察和真实 Git 代表见 `boundary-items.json` 的 `implementation`。

## 实施核对

- 40 项目标均有去向：调查报告 25 项、决策记录 15 项；24 项下沉与 16 项 Git 部分去重的原观察保持可追溯。
- 调查报告删除 7 个纯重复原生节点，其余 18 项保留轻量或原有前半领域验证；旧 unavailable 检查的文件字节保护断言并入既有 CLI discovery 代表。
- 决策记录删除 4 个重复原生节点，其余保留轻量断言或并入已有领域节点；来源漂移代表从三套 scope 仓库保留为一套 all，成功 scope 接线仍由原 CLI 组合测试承接。
- 调查报告 7 项待证测试主体及 4 个直接公共 fixture/helper 与基线字节一致；未修改生产源码、共享 Git 实现、Gate、阈值或分发内容。

## 已执行验证

| 责任 | 命令 | 实际结果 |
| --- | --- | --- |
| 调查报告全量行为 | `bun run test:investigation-report-check` | 最终名称稳定后 298 pass / 0 fail |
| 决策记录全量行为 | `bun run test:decision-records-cli` | 298 pass / 0 fail；格式调整后重复通过 |
| 类型检查 | `bun run typecheck` / `tsgo --noEmit` | 两实现代理最终均为 exit 0 |
| 本轮测试格式与 lint | 对本轮 25 个测试文件执行 Oxfmt check、Oxlint type-aware | 初始 24 文件及移动涉及的 2 文件均通过 |
| 逐项范围 | 核对目标原身份与最终入口、分类数量及保护清单 | 40/40 唯一归属；7 项未列入整改 |
| 独立代码正确性审查 | 核对 97 个旧身份、40 项新入口及实体 ID、7 项保护主体和 50 项真实 Git 代表 | 通过，无阻断；44 个保留代表主体原字节不变，其余 6 个仅授权矩阵收敛或保护断言增强 |
| Case 结构与索引 | `bun run test-evidence -- sync-index --write --json`、`bun run test-evidence -- check --json` | 1153 Case、1339 条引用；40 个 Case 保留身份并更新当前描述 |
| 实体引用 | 生成当前完整 snapshot，独立计算 expected source 后运行公开 `check-refs` | 1294 个实体，1339 条引用有效，零诊断 |
| 项目覆盖 | `bun run check:test-evidence-catalog` | 1294 个入口全部覆盖，missing/uncovered 为 0 |
| 交付前局部优化 | 6 处投影 JSON 的最小结构收窄、Case 证据分层与审查状态复核 | 决策记录再次 298 pass / 0 fail；类型、6 文件格式/lint、Case 结构与 1294 项实体覆盖检查通过；原生名称与断言不变 |
| 首轮项目 Gate | `bun run check` | 60 passed / 1 failed / 3 release 未激活；唯一失败为 `staging-domain.test.ts` 404 code lines 超过现有 360 上限 |
| 文件指标修复 | 原实现 owner 复测调查报告稳定入口、类型/格式/lint 与未改动的原生 File metrics Check | 298 pass / 0 fail；两文件分别为 350 / 132 code lines，File metrics passed、0 finding；移动主体及订阅经独立复核无阻断 |
| 最终项目 Gate | `bun run check` | completed / passed；61 passed、0 failed、0 unavailable；3 项 release 交付检查未激活 |

首次组合叶文件验证暴露的实现问题与未使用导入已修复，最终以上述稳定聚合入口验证。该组合还暴露既有 fixture/template 生命周期对叶文件组合方式的限制；本轮未改 helper 生命周期。

独立正确性审查及优化增量复核均已通过。审查指出历史换行解析的纯 Buffer 断言被写成真实 Git 证据；该 Case 已区分纯解析与真实历史观察，Tests 不变，索引与项目覆盖重新通过。

首轮 Gate 的文件指标阻断已由原实现 owner 定向修复：将新下沉的显式 selector 规则节点原样移入既有 `batch-stage-selectors.test.ts`，主体、名称与断言不变，不新增文件、helper 或阈值例外。修复后的行为、类型、格式/lint 和原生文件指标检查均通过，编码规范复核无需进一步改代码。移动后的唯一实体引用、索引和测试聚合订阅经独立复核通过，最终项目 Gate 已通过。

## 验证边界

本轮未新建上游 Git 或 Vibe 原生机制测试，未测 Git 子进程总数或承诺耗时收益；未执行 release 版本授权和打包。真实 Git 节点减少说明边界收敛，不替代领域观察的正确性证据。辅助运行日志保留在本地忽略目录，不作为长期账本。
