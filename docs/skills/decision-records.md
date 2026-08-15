# Decision Records

`decision-records` 帮助 agent 恢复、审阅和维护会持续影响后续选择的长期判断。每条记录以稳定 Decision ID 标识，记录级 tags 分类，生命周期决定当前位置，持久 JSON 索引提供当前查询快照。

## 当前模型

1. Decision ID 是含 `.md` 的合法 basename；移动位置不改变 ID，改 basename 才是身份变化。
2. 每条 Markdown 都有非空、唯一、有序的 `tags`。tags 只分类，不表示状态、对齐、关系或当前事实，也没有集中 tag catalog。
3. candidate 与 active 记录直属 `docs/decisions/`；archived 记录直属 `docs/decisions/archive/`。`status` 是权威，位置和索引的 `sourcePath` 必须与其一致。
4. 统一索引以 Decision ID 为键，覆盖 active 和 archived 记录。候选由根目录源码发现，始终排除在正式索引外。
5. `list` 默认只返回 active；重复 `--tag` 按 AND 过滤。`show`、`trace`、关系、生命周期与 stage 都使用 Decision ID，输出同时显示 `sourcePath`。
6. lifecycle、关系和 stage 保留完整预检、并发漂移拒绝、原子替换、失败恢复和索引读回校验。stage 选择同一 ID 的位置移动一次即可；它不推断 basename 改名意图，只选新/旧 ID 分别表示新增/删除，同时选择两者才表达改名。
7. 当前分发物只支持这一模型，不提供其他格式的读取、转换、双写、迁移或升级命令。

## 使用与维护

普通恢复先读 `list`，按需使用 `--status`、`--alignment` 与重复 `--tag`；需要完整理由时 `show <decision-id>`，需要演进关系时 `trace <decision-id>`。只有审核未建立方向时才运行 `candidates` 或 `show-candidate <decision-id>`。

写入、修改 tags、生命周期、关系或 pending 快照前，agent 读取 [Skill 入口](../../skills/decision-records/SKILL.md) 与 [决策记录规则](../../skills/decision-records/references/decision-record-rules.md)。精确 CLI 参数以 `scripts/decision-records.mjs --help` 为准；索引字段和版本由 [JSON Schema](../../skills/decision-records/references/decision-index.schema.json) 承接。

手工修改 Markdown 后运行 `sync-index --write`，维护或验收前运行严格 `check`。CLI、索引或事务恢复无法由普通诊断解决时，按 [维护恢复](../../skills/decision-records/references/maintenance-recovery.md) 处理。
