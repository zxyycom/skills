# Proposal

本 Draft Change 为 Decision Records 与 Investigation Report 分别增加可预演、可恢复的 rename 事务，用于纠正名称和执行显式身份迁移。

## Why

Decision 和 Investigation 都让 Markdown basename 承担稳定身份，但目前没有正式 rename 命令。使用者只能手工移动文件，再自行修复索引、关系、资源 owner、选择性暂存和引用；这既容易遗漏领域内依赖，也无法提供零写入预检和明确恢复结果。

Rename 不能替代合法重名建模，也不应成为自动腾挪旧名称的 allocator。它需要独立于日期前缀防重名方案建立，因为前者负责修正既有身份，后者负责新建和无歧义选择，两者具有不同的成功标准和回滚边界。

## Outcome

- Decision Records 和 Investigation Report 各自提供正式 rename 命令，并由对应领域事务拥有需要同步的文件、索引、关系与资源。
- Rename 支持与正式执行相同门禁的只读 preflight；目标冲突、非法身份、陈旧索引、悬空引用或无法证明恢复时，不产生部分身份迁移。
- 日期前缀 ID 建立后，普通 rename 默认保留原日期，只替换语义名称；legacy ID 或显式格式迁移使用单独确认的目标完整 ID，不由工具猜测历史日期。
- 两个领域的关系始终改写为新完整 ID；Investigation 的资源 owner 路径和全部领域内资源引用保持闭合。
- 命令报告旧 ID、新 ID、实际改写范围、提交结果和恢复状态；不会静默修改仓库外引用或把 Git 历史重写成从未使用过旧 ID。
- 两个领域共享 rename 的用户意图与失败原则，但不建设无法表达各自事务差异的通用文件移动平台。
