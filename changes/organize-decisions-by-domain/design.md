# Design

本设计用受控领域目录建立唯一一级分类，并让权威目录表通过通用索引 metadata 进入所有需要理解查询结果的读取路径。

## Context

- 当前未提交实现新增了 19 个受控领域、为当前决策 frontmatter 增加 `domain`、把 domain 投影进 state，并保留历史 pathGroup 目录与可重复 `--domain` 并集查询。
- 当前审计基线为 122 条决策，其中约 57 条需要移动、65 条路径已经与目标领域一致；未发现目标文件名碰撞，约 23 条记录中的 26 个关系 target 需要同步更新。实施前必须重新计算这些数字，基线只用于发现漂移，不是长期契约。
- 实施时从当前工作区重新计算为 123 条决策、57 条移动、66 条路径已一致、24 条记录中的 27 个关系 target 和 2 处仓库直接引用；新增的 `derive-establishment-from-markdown-lifecycle.md` 解释了相对基线的记录、已一致路径和关系各增加 1。19 个领域均已定义且有记录，未知领域、空领域、大小写碰撞和目标占用均为 0。
- `decision-domains.json` 当前包含 19 个按 ID 排序的领域，且当前语料均可映射到一个主要领域。
- 本 change 必须在 `add-typed-index-metadata` 和 `derive-decision-establishment-from-markdown` 完成后实施：前者提供 schema v2 与类型化 metadata，后者移除会阻止路径迁移的 HEAD/pending 边界。
- 中间记录 `use-controlled-decision-domains.md` 应已在前置 change 切换建立状态前丢弃；本 change 创建只表达最终领域路径契约的新决策。

## Goals / Non-Goals

目标：

- 只保留一个一级分类概念：受控 domain。
- 让目录表定义领域语义，路径分配记录领域，索引提供可追溯消费视图。
- 让查询调用方直接获得领域定义，不依赖隐式文件查找。
- 一次性、可审计地迁移全部当前决策身份和直接关系。
- 让领域纠错使用显式路径移动和关系更新，不保留重复字段或别名。

非目标：

- 每条记录只属于一个领域；本 change 不增加 tags、impact 或层级分类。
- 不把领域描述复制进每条 state 或 Markdown。
- 目录、统计和查询都不保留 pathGroup。
- `list` 只提供单领域筛选；通用索引的 `any` operator 本身保持不变。
- 领域由已审阅的迁移清单给出，迁移表不进入长期运行时数据。

## Decisions

1. 决策目录固定为 `<decision-root>/<domain-id>/<semantic-slug>.md`。目录只在至少有一条记录时存在；目录表可以定义暂时没有记录的领域。未知一级目录、嵌套目录、空目录和非 Markdown 内容继续按明确规则失败。
2. `decision-domains.json` 继续使用独立 `schemaVersion: 1`，保存按 ID 升序排列的 `{ id, description }`。它是领域定义的唯一事实源；领域描述不进入 Markdown。
3. Markdown frontmatter 删除 `domain`，字段顺序收敛为 `title`、`status`、`alignment`、`createdAt`、`purpose`、`background`、`decision`、`relations`。scanner 从相对路径第一段得到 domain，并用目录表验证。
4. 决策索引使用通用 schema v2，顶层保存：

   ```json
   {
     "metadata": {
       "domains": [
         { "id": "decision-records", "description": "..." }
       ]
     }
   }
   ```

   `metadata.domains` 是权威目录表的完整派生副本；entry state 不含 domain，`keys.domain` 从 `state.path` 第一段派生并验证其存在于 metadata。
5. 决策领域 definition 使用类型化 metadata parser。逐条 `parseState`、`identify` 和 domain key derive 只依赖已校验 metadata，并在逐条投影时验证路径 domain 存在于目录表；本 change 不需要 decision-specific `validateIndex`。
6. `sourceRevision` 对规范化目录表和全部已建立 Markdown 做稳定 framing。目录表按 schema 字段顺序和已校验的 domain 数组顺序序列化；仅空白或 JSON 排版变化不改变 revision，ID、顺序或描述变化必须改变 revision。
7. CLI 增加 `domains`。该命令直接读取并校验权威目录表，不要求索引存在，固定输出 `Domains:`，随后按 ID 升序输出 `- <id>: <description>`。
8. `list` 接受至多一个 `--domain`，固定输出 `Domains:` 和 `Decisions:` 两个区块。无筛选时，Domains 区块按 ID 升序列出结果实际涉及的定义；显式筛选时，即使没有记录也列出所选定义。空区块写 `- none`。每条 decision 不再重复输出 domain 字段，路径第一段表达归属。重复参数和未定义领域均返回退出码 2。
9. `show` 在原始 Markdown 前输出 `domain: <id>` 与 `domainDescription: <description>`；`trace` 在 Decisions 和 Relations 之前按 ID 升序输出同格式的 Domains 区块，且 decision 行不重复 domain 字段。三者使用已通过 revision 检查的索引 metadata。
10. `check` 与 `sync-index` 只报告领域数量和结构诊断，不打印完整定义；`pathGroupCount`、`DecisionScan.pathGroupIds`、相关错误和帮助文本全部删除。
11. 迁移按经过审阅的“当前路径 -> 目标领域路径”清单执行：先验证所有解析后的绝对源和目标都位于决策根目录且目标唯一，再移动 Markdown，删除 frontmatter domain，更新所有关系 target 和仓库内直接路径引用，最后重建索引。最终工具只识别新路径。
12. 路径仍是当前决策身份。领域纠错若改变目录，就属于显式身份迁移，必须同时更新直接关系和引用并通过完整检查；日常 CLI 不自动移动或猜测。
13. 最终决策索引的通用 `schemaVersion` 为 2、决策 `definitionVersion` 为 3、领域目录表 `schemaVersion` 为 1。当前未提交的中间版本不额外消耗 definition 或 skill 版本。
14. decision-records 的最终分发版本相对 Git 基线从 2 提升到 3；同组前置 change 不重复提升。

## Risks / Trade-offs

- 路径同时承担身份和领域归属，未来领域纠错会要求显式移动并更新关系；这是移除冗余分类字段后的直接成本，不能用 alias 或重复 frontmatter 隐藏。
- 全量迁移涉及大量文件，普通 diff 容易掩盖漏改关系或内容变化；需要机器生成迁移清单、碰撞检查、前后内容哈希对照和严格索引验证。
- 目录表进入 metadata 后，描述变化也会使索引陈旧；这增加一次同步义务，但保证查询输出不会展示过期定义。
- `list` 输出增加领域定义区块，现有快照和调用方必须在同一 change 中同步到固定新格式。
- 当前工作区已有大面积中间改动。实施必须基于实际 diff 逐项收敛，不能先回退用户改动再重新实现，也不能把中间 pathGroup 语义带入最终文档。

## Open Questions

无。
