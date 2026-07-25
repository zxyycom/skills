# Proposal

本 change 计划让受控决策领域成为唯一一级分类和目录路径基础，并把领域定义作为决策索引 metadata 提供给查询；本文是实施前计划，不表示相关迁移已经执行。

## Why

受控领域已经被选为决策的一级分类，但当前未提交实现仍同时维护 frontmatter `domain`、独立 `pathGroup` 目录和可重复多领域查询。同一条记录因而存在两个一级分类来源，查询结果还只能看到领域 ID，读取方必须自行寻找 `decision-domains.json` 才能理解定义。本 change 让目录表定义领域、路径分配领域、索引提供领域消费视图，三个职责从同一个权威来源派生。

## Outcome

- 决策目录固定为 `<decision-root>/<domain-id>/<semantic-slug>.md`；路径第一段直接表示受控领域。
- `decision-domains.json` 是领域 ID 与描述的唯一权威源；Markdown frontmatter 不再保存 `domain`。
- 决策索引 schema v2 的 `metadata.domains` 保存目录表的派生副本；每条 state 不保存 domain，`domain` key 从路径第一段确定性派生。
- CLI 增加 `domains` 命令；list、show 和 trace 直接输出相关领域定义。
- list 只接受零个或一个 `--domain`；重复参数明确失败，不再提供多领域并集查询。
- 移除 `pathGroup` 类型、计数、校验、文档和输出，并把当前全部决策及关系一次性迁移到领域目录。

## Scope

纳入范围：

- 决策目录表、路径契约、frontmatter、state、keys、source revision、索引 metadata 和 JSON Schema。
- scanner、CLI 参数、domains/list/show/trace/check/sync-index 输出、公共声明和测试。
- 当前决策语料的全量路径移动、frontmatter domain 删除、关系 target 更新和索引重建。
- decision-records skill、固定契约、恢复手册、人类介绍、导航和相关长期决策。
- 当前未提交的 frontmatter-domain/pathGroup/multi-domain 实现的收敛与清理。

不纳入范围：

- 多值 tag、影响面数组、领域层级、领域别名或跨领域 federation。
- 读取 pathGroup、旧路径或 frontmatter domain；最终工具只接受领域目录契约。
- 自动判断一条决策应该属于哪个领域；实施使用已经审阅的目录表与当前分类映射。
- 修改通用索引 metadata 协议或决策建立状态；这些由前置 change 承接。

## Success Criteria

- 决策根目录中的每个一级目录都等于一个已定义 domain ID；不存在 pathGroup 概念或未知目录。
- 每条 Markdown frontmatter 只保留生命周期、语义摘要和关系字段，不包含 domain；路径第一段是唯一领域归属。
- `decision-index.json` 使用 schema v2，包含完整 `metadata.domains`，state 不含 domain，domain key 与路径第一段一致。
- `sourceRevision` 同时覆盖规范化领域目录表和全部已建立 Markdown；领域描述变化会使旧索引失效。
- `domains` 即使在索引尚未建立时也能从有效目录表输出全部定义；list、show、trace 在索引新鲜时输出所涉及领域的 ID 与描述。
- 重复 `--domain` 返回参数错误；单个已定义但无匹配记录的领域返回空结果且仍显示该领域定义。
- 当前迁移基线重新核对后，全部路径移动与关系更新无碰撞、无悬空目标、无旧路径引用。
- decision-records 测试、生成检查、严格决策检查、类型检查和完整仓库检查通过。

## Affected Owners

- `docs/decisions/decision-domains.json`：受控领域 ID 与边界定义。
- `docs/decisions/<domain-id>/*.md` 与 `decision-index.json`：当前决策事实和派生索引。
- `skills/decision-records/SKILL.md`、固定契约和恢复手册：领域选择、路径、查询和维护行为。
- `tools/decision-records/`：目录扫描、metadata、索引 definition、CLI、事务、schema、声明和测试。
- `tools/index-runtime/README.md` 与前置 metadata change：通用 metadata 承载契约。
- `docs/navigation.md` 与 `docs/skills/decision-records.md`：仓库路由和人类入口。
- `docs/decisions/decision-records/`：领域分类、路径身份和查询的长期判断。
- `docs/coding-style.md` 与 `docs/tooling.md`：实现边界、生成和验证。
