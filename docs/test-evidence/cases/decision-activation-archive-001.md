### Case DECISION-ACTIVATION-ARCHIVE-001: 发布与归档保持内容和索引原子性

Tests:
- `test:c23298903afab34c1b40658f194ad96b84de36eb3917a61530925133e09ee6a8`

Tags:
- `decision-records`

Contract:
- 候选发布、对齐、归档与重新启用必须同步更新 Markdown 和正式索引；归档及重新启用保留既有 createdAt 与最后对齐状态。

Proves:
- 已对齐活动记录不能被 publish 或 reactivate 改写为其他生命周期形态，拒绝后 Markdown 与索引不变。
- 候选发布写入规范 createdAt，重复 publish 返回领域失败且字节不变；缺失或损坏索引可由后续生命周期命令重建。
- 归档保留 aligned 与 createdAt；归档后缺少 alignment 确认的 reactivate 零写入，提供确认后重新启用继续保留原 createdAt，源码与打包查询入口均不暴露旧 pending 或 Git HEAD 语义。
