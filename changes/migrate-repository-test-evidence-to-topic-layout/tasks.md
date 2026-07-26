# Tasks

任务按前置能力、主题审阅、可比迁移、owner 切换和严格验收推进，完成出口是本仓库只保留最终 topic 目录。

## Readiness

- [ ] 0.1 确认 `organize-test-evidence-by-topic` 已实施并通过验证，最终工具、Schema 和升级契约可用于真实仓库。
- [ ] 0.2 从当前工作区恢复全部 test-evidence 源和用户改动，明确本 change 只拥有目录、配置、项目说明、检查接入和相关决策。
- [ ] 0.3 生成实施起点 case 清单，核对合法 case 总数、ID 唯一性、字段完整性和当前源路径，不沿用计划中的临时数量。
- [ ] 0.4 审阅最终 topic ID、description 和每个 case 的主要责任归属，解决 `Open Questions` 后再开始移动。
- [ ] 0.5 核对三个 artifact 的范围一致，并确认测试实现改造与历史完整性审计由后续 change 承接。

## Implementation

- [ ] 1.1 创建并校验本仓库 `test-evidence-topics.json`，让定义顺序、ID 和责任描述符合前置工具契约。
- [ ] 1.2 从实施起点生成源 case 到目标 `<topic-id>/<semantic-slug>.md` 的迁移清单，检查目标碰撞、越界路径和直接仓库引用。
- [ ] 1.3 按清单创建单 case Markdown，逐项保持 ID、Entry、Contract 和 Proves，并对任何内容修复单独记录理由。
- [ ] 1.4 运行前后规范化内容与 ID 集合对照，通过后移除中间聚合主题文件和无效空目录。
- [ ] 1.5 更新 `.test-evidence.json`、README、AGENTS、导航、工具链说明和人类入口，使其只描述最终根目录、topic 选择和统一索引。
- [ ] 1.6 把最终目录检查与索引新鲜度接入项目 check，并同步相关 package script、check 计划及其测试。
- [ ] 1.7 从合法主题表和全部 case 重建统一索引，验证按 topic、ID、Entry、Contract 和 Proves 的代表性查询。
- [ ] 1.8 通过决策演进建立最终 topic 路径判断，处理当前中间活动决策及其前序关系，并在事实完整核对后标记 aligned。

## Verification

- [ ] 2.1 比较迁移前后 case ID 集合、规范化字段和计数，证明除明确批准的修复外没有丢失、重复或语义漂移。
- [ ] 2.2 运行 topic 目录严格检查，确认未知、空、嵌套目录、聚合多 case 文件和中间路径均不存在。
- [ ] 2.3 运行 list、list --topic 和 show 的代表性查询，确认每个结果回到正确单 case 文件及 topic 定义。
- [ ] 2.4 检查仓库 Markdown 链接、配置路径、package script 和项目 check，不再引用旧 `cases.md` 或中间 `cases/*.md` 格式。
- [ ] 2.5 运行严格决策检查、test-evidence 目录检查、类型检查和 `bun run check --strict`，记录实际结果。
- [ ] 2.6 人工审阅最终 topic 表和样本 case：只给读取者目录表、索引结果和一份 case 时，能够恢复主题边界、稳定 case ID 和权威源路径。
