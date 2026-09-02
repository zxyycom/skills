# 调查报告维护恢复

本手册承接 `investigation-report` 的 CLI 诊断、candidate 与正式集合 mutation，以及 pending 写入异常。正式报告、candidate、资源与索引的权威关系和精确命令语义由[固定契约](investigation-report-contract.md)承接；本手册不把命令输出变成持久状态。

## 先判断范围

1. 成功信息在 stdout，失败和 warning 在 stderr。先按诊断中的 `code`、对象、原因和下一步定位；有 `scope` 与 `outcome` 时，只对该声明范围作恢复判断。
2. warning 不改变 candidate、正式报告、资源、工作区索引或 pending。处理 warning 后再依赖相应集合状态；它不能替代错误、publish 授权或写入授权。
3. `new` 创建成功即使 body/resource readiness 或辅助 preflight 有 warning 也已经建立 candidate；不要重跑 `new`。改为 `show-candidate`、编辑内容或运行 `publish --preflight`。
4. `publish --preflight`、`candidates`、`show-candidate`、查询与检查只读，不产生 mutation outcome 或 receipt。预检结果只对应本次读取，普通 publish 必须重新准备。
5. `stage-index` 只拥有目标正式索引的 pending 路径；`sync-index`、`set-relations`、正式 `discard`、`publish` 与 `discard-candidate` 各自拥有固定契约声明的工作区范围。不得从其中一个结果推断另一个范围已经提交、恢复或安全重试。

## 按 outcome 恢复

1. `no-change`：声明范围未改。处理前置条件后，从当前事实显式重试。
2. `rolled-back`：索引提交点前失败，但声明范围已恢复完整旧状态。复核 candidate、正式报告、资源和索引后，再决定是否显式重新发起操作。
3. `partial-or-unknown`：不能证明声明范围已完整恢复。停止 mutation，保留现有来源，核对 candidate、正式 Markdown、资源、索引与可用可信版本；无法唯一确认完整状态时交给 owner。
4. `committed-cleanup-pending`：领域提交点已经越过。publish 时正式报告和索引已经提交；discard 或 discard-candidate 时相应对象已退出自己的集合范围。先检查诊断列出的 tombstone 或 cleanup 残留，再开始新的 mutation。

## 操作者边界

1. 权限问题只授权当前进程所需的访问；不得用 `sudo` 扩大权限。
2. lock busy 时等待或确认活动进程结束；只有确认没有活动进程后才人工检查残留锁。工具和 agent 不自动删除锁。
3. 不自动重试。尤其是 candidate、正式来源、资源、索引或 pending 恢复不完整、范围归属不清或原因未知时，必须先重新观察和对账，无法唯一归因即停止并交给对应 owner。
4. 发现手工正式来源变化、索引缺失、损坏或陈旧时，不能用 publish 混合接纳；完整核对正式报告和资源后，使用 `sync-index` 显式恢复或接纳。合法 candidate 不进入这次同步。

## 验证

恢复出可解释的完整正式集合后，运行默认全量 `check`。需要重建派生索引时，先确认全部正式报告和资源来源完整，再运行 `sync-index`，随后再次运行 `check`；不要用索引覆盖或补造报告 Markdown 与资源事实。candidate 的单独问题通过 `show-candidate` 或 `publish --preflight` 核对，不以同步索引修复。
