# Tasks

本 change 先实现阶段模型和 Git 距离，再接入命令、查询与迁移，最后同步行为 owner、测试证据和长期决策。

## Readiness

- [x] 0.1 读取 change-plan 行为入口、固定契约、基础生命周期决策、阶段决策、工具链、编码规范和测试证据维护入口，确认当前实现与 owner 边界。
- [x] 0.2 确认 `.change-plan.json` 是 active 阶段事实源，阶段为 draft、plan、implementation、shelved，迁移后不保留旧 active 格式。
- [x] 0.3 确认搁置使用统一 `git-distance-v1`，依据计划后的 first-parent 提交数和累计 diff 行数，不使用时间或每 Change 阈值。
- [x] 0.4 确认显式 shelve、机械 reconcile、resume 后重新确认、candidate 阻断 implement 和 implementation-only archive 的推进路径。
- [x] 0.5 完成 proposal、design 和 tasks 的 AI-ready 审阅，使实现代理能够直接恢复阶段、算法、命令、迁移和验收主线。
- [x] 0.6 完成项目环境自举和检查，确认锁定依赖、Bun、pnpm 与 CodeGraph 索引可用。

## Implementation

- [x] 1.1 在 `tools/change-plan/` 实现无 schema version 的 `.change-plan.json` 判别联合、读取写入和 active metadata 检查。
- [x] 1.2 按阶段改造 artifact 与任务检查：draft 接受最小 proposal，plan、implementation 和 shelved 使用完整三文件，并提供任务区段进度。
- [x] 1.3 在共享版本控制层实现独立的 first-parent revision 操作及 numstat、路径和错误契约，并在 Change Plan 中实现当前 change 目录排除、距离聚合与阈值判断。
- [x] 1.4 实现 `git-distance-v1`、current、shelve-candidate、plan-review-required 及 assessment evidence。
- [x] 1.5 实现 `plan`、`implement`、`shelve --reason`、`reconcile` 和 `resume`，并为 archive 增加 implementation 阶段门禁。
- [x] 1.6 扩展 list、show、check、stage filter、文本与 JSON 输出、CLI 帮助和退出码，并保持当前 MJS 底层函数可直接 import。
- [x] 1.7 从运行时生成自包含 MJS 和可移植 source map；不生成 `.d.mts`、SDK 声明树或 metadata JSON Schema，也不为直接 import 建立稳定 API 承诺。
- [x] 1.8 同步 change-plan skill、固定契约、发现入口和独立版本；保持既有阶段决策语义不变，并准备可独立审核的 Git 距离机械搁置候选决策。
- [x] 1.9 重新读取 active catalog，逐项确认阶段和已提交基线，为全部 active Change（包括本 change）写入 metadata。
- [x] 1.10 新增或调整共享版本控制契约及 Change Plan 的元数据、阶段、Git 距离、命令、查询、archive、迁移和当前 MJS runtime 原生测试，并同步各自测试证据 case 与派生索引。

## Verification

- [x] 2.1 验证四阶段 metadata、draft 最小内容、其他阶段完整三文件、任务区段进度和 active/archived 边界。
- [x] 2.2 在真实临时 Git 仓库验证 Change 目录排除、同名兄弟目录与混合提交边界、新增和删除行累计，以及 first-parent 顺序、merge、空提交、二进制 numstat 和故障语义；用一组九个低变更提交代表性地端到端验证候选发现、reconcile 与重新确认分支。
- [x] 2.3 验证 plan、implement、显式 shelve、reconcile、resume 与 archive 的合法路径，以及 candidate、待复核 plan 和 shelved 的推进门禁。
- [x] 2.4 验证 list、show、check、stage filter、紧凑候选摘要、JSON evidence、可直接 import 的当前 MJS runtime exports 和 `0/1/2` 退出码，不把直接导入验证扩大为稳定 SDK 契约。
- [x] 2.5 审阅全部 active Change 的迁移结果，确认 stage、`baseCommit` 和现实工作状态一致，catalog 中没有缺失 metadata 的 active 条目。
- [x] 2.6 运行 change-plan 原生测试、生成制品检查、skill 验证、测试证据检查、决策严格检查和 `bun run check --full`。
- [x] 2.7 对照成功标准完成语义审阅；实现、文档、迁移和验证全部成为当前事实后，将既有阶段决策 `mark-aligned`，并将 Git 距离机械搁置候选以 aligned 激活。
- [x] 2.8 完成归档前审阅并取得明确归档授权后，勾选本项并运行 change-plan archive。
