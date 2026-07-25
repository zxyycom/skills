# Tasks

任务按前置门禁、领域契约、工具行为、语料迁移和全量验证执行，完成出口是领域成为路径、索引和查询的唯一一级分类。

## Readiness

- [x] 0.1 确认 `add-typed-index-metadata` 已提供 schema v2 与类型化 metadata，`derive-decision-establishment-from-markdown` 已移除 HEAD/pending 路径门禁并丢弃中间领域决策。
- [x] 0.2 核对三个 artifact 都以“domain 是唯一一级分类和路径基础”为目标，并确认最终输入只接受领域目录、单领域筛选和 schema v2 索引。
- [x] 0.3 从当前工作区重新生成每条决策的源路径、目标领域路径和关系更新清单，核对总数、目标碰撞、未知领域、空领域及仓库内直接路径引用；将结果与 122/57/65/26 的审计基线比较并解释差异。
- [x] 0.4 审阅 19 个领域 ID、description 和每条决策的主要契约 owner；可独立演进的混合判断在迁移前拆分，不用多领域字段掩盖。
- [x] 0.5 核对未提交中间实现与用户其他改动，明确哪些内容继续使用、重写或删除，不覆盖无关改动。
- [x] 0.6 确认 `Open Questions` 为“无”，领域归属、CLI 输出、迁移规则和版本出口足以直接实施。

## Implementation

- [x] 1.1 收敛领域目录表 loader、类型与 schema，使 `decision-domains.json` 继续作为唯一权威定义，并为索引 metadata 提供确定性的类型化投影。
- [x] 1.2 重写决策路径、Markdown parser、state、key 和 source revision：路径第一段提供 domain，frontmatter/state 删除 domain，revision 纳入规范化目录表。
- [x] 1.3 从 scanner、validation result、事务、诊断和统计中删除 pathGroup 抽象，只允许已定义 domain 目录并处理无记录领域。
- [x] 1.4 更新 CLI 参数与帮助：新增 `domains`，把 list 的 `--domain` 限制为至多一次，删除多领域并集解析与输出。
- [x] 1.5 按 design 的固定文本格式更新 domains、list、show 和 trace，并让查询从新鲜索引 metadata 取得描述；check 与 sync-index 保持摘要输出。
- [x] 1.6 更新决策索引 definition、通用 schema v2 组合、公共声明与 JSON Schema，使 metadata 包含 domains、state 不含 domain、key 从路径派生。
- [x] 1.7 按已验证迁移清单移动全部决策 Markdown，删除 frontmatter domain，更新所有关系 target 和仓库内直接路径引用，并清理不再使用的旧一级目录。
- [x] 1.8 创建最终“领域作为路径与一级分类”决策；同步修订或归档仍与主题目录、稳定 pathGroup、frontmatter domain 或多领域查询冲突的长期决策。
- [x] 1.9 更新 decision-records `SKILL.md`、固定契约、恢复手册、人类介绍和 `docs/navigation.md`，只在各自 owner 保留完整规则。
- [x] 1.10 重建 `decision-index.json`、分发 MJS、声明、source map 和 JSON Schema，并确保 decision-records 版本相对基线只提升到 3。

## Verification

- [x] 2.1 增加目录表与路径测试，覆盖未知 domain 目录、缺失目录、无记录领域、嵌套目录、空目录、frontmatter 残留 domain 和路径派生 key 不一致。
- [x] 2.2 增加 schema v2 metadata 测试，覆盖目录表描述变化导致 revision 失配、规范化排版不造成虚假漂移、state 不含 domain 和完整 domains 投影。
- [x] 2.3 增加 CLI 测试，覆盖 domains 无索引读取、Domains/Decisions 空区块、list 单领域与空结果、重复/未知 `--domain`、show/trace 定义输出以及 check/sync 摘要。
- [x] 2.4 对迁移前后语料执行文件内容对照，证明除路径、frontmatter domain、关系 target 和明确决策演进外没有语义文本漂移。
- [x] 2.5 检查全部关系 target、Markdown 链接、导航路径和索引 entry，确认没有旧目录引用、碰撞、悬空目标或 pathGroup 术语残留。
- [x] 2.6 运行 decision-records 行为测试、生成漂移检查、严格决策检查、`bun run typecheck` 和 `bun run check`，记录实际结果与任何 warning。
- [x] 2.7 用 AI 阅读任务复核最终文档：仅给出 skill 入口、固定契约和查询输出时，能够恢复领域定义 owner、路径归属、单领域查询、迁移边界和当前唯一输入格式。
