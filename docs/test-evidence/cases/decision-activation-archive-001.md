### Case DECISION-ACTIVATION-ARCHIVE-001: 激活与归档保持内容和索引原子性

Tests:
- `test:ae20aaa497a342c6b9c9b8af49f7106deb21510432fa1e411fd3ca64659cf143`

Tags:
- `decision-records`

Contract:
- 普通决策激活、对齐、归档与重新激活必须同步更新 Markdown 和正式索引；归档及重新激活保留既有 createdAt 与最后对齐状态。

Proves:
- 已对齐活动决策不能回退为 unaligned，拒绝后 Markdown 与索引不变。
- 候选激活写入规范 createdAt，重复激活幂等；缺失或损坏索引可由后续生命周期命令重建。
- 归档保留 aligned 与 createdAt，重新激活继续保留原 createdAt，源码与打包查询入口均不暴露旧 pending 或 Git HEAD 语义。
