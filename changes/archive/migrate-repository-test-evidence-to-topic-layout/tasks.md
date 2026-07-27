# Tasks

任务按前置能力、主题审阅、可比迁移、owner 切换和严格验收推进，完成出口是本仓库只保留最终 topic 目录。

## Readiness

- [x] 0.1 确认 `organize-test-evidence-by-topic` 的通用源码、v3 分发物与 Schema、升级契约和目标测试已完成并可交接；不要求它先归档或在当前 v2 仓库上独立通过最终 strict。
- [x] 0.2 从当前工作区恢复全部 test-evidence 源和用户改动，明确本 change 拥有目录、配置、项目说明、检查接入、相关决策，以及两个既有 repository consumer 节点的 v3 sourcePath/topic 断言与 runner import 恢复。
- [x] 0.3 生成实施起点 case 清单，核对合法 case 总数、ID 唯一性、字段完整性和当前源路径，不沿用计划中的临时数量。
- [x] 0.4 将实施起点 case 与 design 中九个 topic、七个整文件映射和 `shared-infrastructure` 精确 ID 分流逐项核对；新增或变化的 case 按 Contract 与 Proves 的稳定 owner 归属。
- [x] 0.5 核对三个 artifact 的范围一致，确认两项 change 连续交付、有限 repository consumer 集成交接、最终 strict 共同关闭且不引入双读，并确认除此之外的测试重构、粒度审计与历史完整性审计由后续 change 承接。

## Implementation

- [x] 1.1 按 design 固定的九个 ID 与责任描述创建并校验本仓库 `test-evidence-topics.json`，让机器结构符合前置工具契约。
- [x] 1.2 从实施起点生成源 case 到目标 `<topic-id>/<semantic-slug>.md` 的迁移清单，应用七个整文件映射与 `shared-infrastructure` 精确分流，并检查目标碰撞、越界路径和直接仓库引用。
- [x] 1.3 按清单创建单 case Markdown，逐项保持 ID、Entry、Contract 和 Proves，并对任何内容修复单独记录理由。
- [x] 1.4 运行前后规范化内容与 ID 集合对照，通过后移除中间聚合主题文件和无效空目录。
- [x] 1.5 更新 `.test-evidence.json`、README、AGENTS、导航、工具链说明和人类入口，使其只描述最终根目录、topic 选择和统一索引。
- [x] 1.6 把最终目录检查与索引新鲜度接入项目 check，并同步相关 package script、check 计划及其测试。
- [x] 1.7 从合法主题表和全部 case 重建统一索引，把两个既有 repository catalog 节点的断言切换到最终 catalog-relative sourcePath/topic 并恢复 `run.ts` import，同时保持节点名称、意图和数量不变，再验证按 topic、ID、Entry、Contract 和 Proves 的代表性查询。
- [x] 1.8 通过决策演进建立最终 topic 路径判断，处理当前中间活动决策及其前序关系，并在事实完整核对后标记 aligned。

## Verification

- [x] 2.1 比较迁移前后 case ID 集合、规范化字段和计数，证明除明确批准的修复外没有丢失、重复或语义漂移。
- [x] 2.2 运行 topic 目录严格检查，确认未知、空、嵌套目录、聚合多 case 文件和中间路径均不存在。
- [x] 2.3 运行 list、list --topic、show 和两个 repository catalog 原生节点，确认查询结果回到正确单 case 文件及 topic 定义，且恢复 import 后两个节点仍以原名称和意图进入 runner。
- [x] 2.4 检查仓库 Markdown 链接、配置路径、package script 和项目 check，不再引用旧 `cases.md` 或中间 `cases/*.md` 格式。
- [x] 2.5 目录、配置与有限 consumer 集成交接完成后运行 31-node test-evidence runner、严格决策检查、目录检查、类型检查和 `bun run check --strict`，把最终 strict 结果同时作为本 change 与 `organize-test-evidence-by-topic` 的关闭证据。
- [x] 2.6 人工审阅最终 topic 表和样本 case：只给读取者目录表、索引结果和一份 case 时，能够恢复主题边界、稳定 case ID 和权威源路径。
