# Proposal

审计并补全 Decision 与 Investigation relation summary 的生产、投影、展示和使用链路，使新增的边语义不只停留在可选存储字段中。

## Why

relation summary 已进入 Markdown、派生索引、领域类型、搜索和 trace，但字段保持兼容可选，既有边没有批量回填；部分查询只用关系筛选记录或展示 type 与 target，没有把已存在的边说明交给调用方。当前需要分别识别“边本身没有摘要”和“摘要存在但消费路径没有展示或使用”，再逐一决定每个入口应承担的语义，而不是假定新增字段已经完成了使用改进。

## Outcome

Decision 与 Investigation 的每个 relation summary 生产和消费入口都有显式决定：是否要求、保存、投影、搜索、返回、展示或有意省略；历史缺失摘要具有量化基线和明确处理策略，agent 能区分无摘要、未读取与被输出隐藏，相关契约和验证与最终选择一致。
