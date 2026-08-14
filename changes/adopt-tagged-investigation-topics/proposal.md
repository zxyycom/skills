# Proposal

本 draft Change 探索把 Investigation Report 从 category 目录分类改造为平铺 topic 文件、稳定文件名和记录级 tags 驱动的检索模型。

## Why

当前 Investigation Report 的 topic ID 等同于 `<category-id>/<semantic-slug>.md`，category 同时进入物理目录、索引键和选择性暂存输入。调查主题一旦需要重新归类，纯分类调整就会变成身份和路径迁移；一个主题也无法自然地同时属于多个观察维度。

调查报告没有活动/归档生命周期，category 的主要价值只是分类。继续让它决定目录和 topic ID，会用结构性约束换取可以由索引与 tags 更直接提供的筛选能力。当前只有 12 个 topic，适合在模型继续扩张前完成一次边界清楚的迁移。

## Outcome

调查 topic Markdown 在权威根目录中平铺保存，以跨目录稳定且在三个资源集合中全局唯一的文件名标识，每个 topic 通过自身 tags 表达多个分类维度。派生索引投影稳定 topic ID、tags、状态和现有摘要信息，查询与选择性暂存不再依赖 category 路径；报告追加、资源附件、状态和最新结论等 Investigation Report 专属行为保持不变，且不引入不需要的归档模型。
