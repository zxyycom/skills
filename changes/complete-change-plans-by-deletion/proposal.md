# Proposal

本 Draft Change 移除独立 Change Plan 的 archive 生命周期，并以完成后删除 Change 目录、通过 Git 恢复历史的方式收敛短期计划责任。

## Why

当前 `archive` 只把完成后的 Change 目录移动到 `changes/archive/`。Archived Change 不再接受结构检查、stage、Git 距离或持续链接维护，也不会像 OpenSpec archive 那样把 delta spec 同步到稳定事实；它主要保存一份被动计划快照，却持续占用名称并扩大 list、show、status 和目录契约。

Change 的 proposal、design 与 tasks 用于实施期间规划和交接。完成后，稳定事实应进入对应项目 owner，长期判断进入 Decision，独立复核的认识进入 Investigation；Git 已能保留 Change 在实施期间的版本历史。继续为完成目录建设日期 ID、名称 resolver 或 rename 机制，维护成本高于剩余价值。

## Outcome

- Change Plan 生命周期从 `active/draft -> active/plan -> archived` 收敛为 `active/draft -> active/plan -> complete-and-delete`；完成不是持久 status，成功后目录退出当前文件系统集合。
- 以显式 `complete` 操作替代 `archive`。它在删除前执行最终 Plan 门禁、任务完成检查和 Git 可恢复性检查，并报告被删除目录及可恢复的 Git revision。
- 完成操作只删除已经完整进入 Git HEAD、工作树内容与该基线一致且没有未跟踪或忽略成员的 Change；不能证明可恢复时零写入失败。
- `archive`、archived status、`list --archived/--all` 和 archived `show` 行为退出公开契约；Change Plan 不再为历史名称提供日期 ID、唯一名称解析或 rename。
- 现有 `changes/archive/` 在实施迁移中逐项确认 Git 可恢复后从当前树删除；无法证明已记录的成员暂停并单独处理，不覆盖或静默遗失内容。
- 历史 Change 通过普通 Git log/show 恢复；当前稳定行为、长期理由和调查证据继续由各自 owner 承接，不把 Change 目录变成第二历史知识库。
