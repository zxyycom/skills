# Proposal

让 Decision Records 的全部已建立记录具有明确 alignment，并移除历史空值的正常读取与展示分支。

## Why

当前 active 要求非空 alignment，archived 却允许 null，索引因此省略字段，list 又将其汇总为 unknown。
历史数据完成召回后，这一例外不再属于支持契约；统一非空约束能让类型、校验、查询与归档语义一致。

## Outcome

active 与 archived 在来源、类型、索引和公开查询中都具有 aligned 或 unaligned。
缺失或 null 的已建立记录被拒绝且得到可行动诊断；candidate 继续保持合法的 alignment:null、
createdAt:null，并留在正式索引外。

## Scope

### Intended Change

- 收紧来源与派生索引的 alignment 必填约束，同步领域类型、JSON Schema 和公开声明。
- 移除已建立记录的缺失值转换以及 list 的 unknown 统计桶，保持已有筛选与分页含义。
- 更新 skill 行为、恢复说明、人类介绍、测试与分发产物。

### Resulting Impacts

- 领域 definitionVersion 与 skill 独立版本递增；通用索引 schemaVersion 保持 4。
- 在来源合法后全量重建索引，不兼容加载旧 definition，不自动猜测或迁移历史值。
- 提供升级准备、未准备集合的失败诊断与恢复路径；不修改通用 updater 或代替其他项目完成召回。
- 按测试证据契约更新受影响 Case 与索引，按长期决策门槛记录已建立记录的统一约束。

## Success Criteria

1. 本仓库历史召回证据已验收，当前全部已建立来源具有有效非空 alignment。
2. active/archived 的 null 和缺失输入在来源、索引与维护入口被拒绝；非法输入零写入，不静默跳过或补值。
3. candidate 创建、查询、readiness 与首次建立保持原有状态组合；合法归档保留最后 alignment。
4. list 文本与 JSON 不再包含 unknown 统计桶，已建立查询结果的 alignment 均非空，原有筛选口径不变。
5. 新 definition 索引由合法 Markdown 重建；过期索引和非法来源得到不同的恢复指引。
6. 源码、声明、Schema、分发产物、skill 文档、测试证据及长期决策一致，相关测试与全仓检查通过。

## Affected Owners

- `tools/decision-records/`：领域类型、来源解析、索引 Definition/Schema、查询、维护及原生测试。
- `skills/decision-records/`：行为规则、恢复路径、skill 版本与生成分发产物。
- `scripts/build/decision-records.ts`：现有生成入口，仅在构建闭包需要调整时修改。
- `docs/skills/decision-records.md`：面向使用者的升级准备。
- `docs/decisions/`、`docs/test-evidence/`：长期契约判断与受影响测试证据，索引通过各自 CLI 派生。
