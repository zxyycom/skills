# Proposal

本 Draft Change 为 Decision Records 与 Investigation Report 分别增加可预演、可恢复的身份/name 迁移事务，并为 legacy ID 只在真实名称冲突前升级为标准 dated ID 提供正式路径。

## Why

显式纯 ID 与 sourcePath 分离后，文件路径不再定义身份；但合法 basename 只有 name 或 ID，两者都包含 name，因此真实 rename 通常仍会同时改变记录 ID、name 和 sourcePath。使用者需要在名称错误、身份格式迁移或 legacy name 即将重名时安全更新这些事实，以及由 ID 派生的关系、索引和资源 owner；手工改 frontmatter 或移动文件都无法闭合这些领域依赖。

Rename 不能替代合法重名建模，也不应为了采用日期格式立即批量改写历史。它应让 unique legacy name 继续使用，只有准备形成同名 dated 记录时才要求先完成可审计的 ID 迁移。

## Outcome

- Decision Records 和 Investigation Report 各自提供正式 rename 命令，由对应领域事务拥有 ID、name、索引、关系和资源更新。
- Rename 支持与正式执行相同门禁的只读 preflight；目标冲突、非法标准 ID、陈旧索引、悬空引用或无法证明恢复时不产生部分迁移。
- 普通 source 输入遵循日期身份 Draft 的 ID-first 管线；unique legacy name 可以在发生冲突前直接定位并迁移，不要求全量历史重命名。
- Target 输入也先尝试解析标准 ID，解析失败才作为新 name；不要求用户为日常 rename 预先区分 `--name` 和 `--id`。
- 标准 dated ID 的新 name 自动沿用原日期；legacy 升级使用权威形成时间补入日期，不从文件名或当前时间猜测历史。
- Rename 按目标 name/ID 重新计算记录 sourcePath：name 路径可用时使用 name，否则使用完整 ID；新旧路径不同时随事务移动，文件 basename 不反向定义身份。
- 两个领域的关系始终改写为新完整 ID；Investigation 的资源 owner 路径和全部受管资源引用保持闭合。
- 命令报告旧/新 ID、旧/新 name、旧/新 sourcePath、实际改写范围、提交结果和恢复状态；不改写 Git 历史或仓库外引用。
