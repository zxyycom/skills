# Design

共同 owner 统一实际写集与阶段验收，领域只保留自身语义和生命周期义务。

## Context

基线 `66cf190967fd9ea7a0654412c29c955801951923`。IR rename 的 original guards 已覆盖所有来源，但 renamedSourceWrites 同时把 unchanged 来源列为 writes；journal 实际跳过未变项，所以症状是冗余验收而非全量重写。共享 verifyPlan/verifyWritten 逐项验 writes，仅 guards 使用 batch。IR rename 在 beforePublish hook 后另串行读取全部来源和既有索引。DR rename 只表达变更来源并以 guards 保护其余来源。

## Goals / Non-Goals

目标：共同义务不再受领域计划表示左右；安全事实与阶段隔离完整；以真实 changed 集合验证批量路径。非目标：合并领域图、公开 CLI/SDK、DR archive/lifecycle 或 IR 资源移动、Index Runtime stage，新增 worker 调度策略或跨阶段缓存。

## Decisions

### Intended Change

主代理已认可以下共同边界，按本设计实施：

1. `record-operations` 提供窄的计划归一化：验证每个提案的权限意图与重复 write path，把 journal 同义 unchanged 提案转为 guard，保留真实写入顺序及 index 提交职责。DR 通用事务计划、IR rename/discard 显式消费；不引入 provider 或通用事务框架。
2. shared verifyPlan 先检查整个 write/index 的结构与权限，再将 writes/index/guards 一次有序交给 verifyMany；verifyWritten 使用实际 written snapshot（不是 plan.next）及未写 guards，独立新 phase。跨表示规模达到既有阈值即可 batch。
3. shared fresh 回调显式收到写前 phase；IR rename 使用该 phase 的安全 snapshot 比较来源与索引，按原顺序聚合每份来源失败，再追加 target、index、resource target 错误。phase 只保留实际观察，不保留 caller expected 引用。same root/path/bytes/dev/ino/mode/完整父链相同才免重读。
4. beforePublish 先于所有共享 fresh 来源观察。无用户 hook/写入的后续资源证明和 membership 读取属于同一写前边界；no-op 的重新身份准备保留独立读取，不采用提前共享来折叠它。
5. discard 也使用统一计划和验收。IR discard 的 hook 后 full collection 对照、transaction fresh 的完整领域资源/图验证、post collection 与精确 tombstone 清理暂保留原时点；这些不是可以仅凭 source bytes 直接代替的共同文件义务。通过矩阵说明例外，不假装与 DR 完全相同。

### Resulting Impacts

场景 × 义务：

| 场景 | prepare | 写前共同义务 | 领域额外义务 | 写后及恢复 |
| --- | --- | --- | --- | --- |
| DR formal/candidate rename | 完整来源/历史/图与强 snapshot | 全部源/index/目标缺失，安全 fresh；统一队列 | status/archive/name 与完整最终图 | 实际 handle/readback、members、共同 CAS；candidate 无伪 index |
| IR formal/candidate rename | 完整 layout/formal/candidate/resource 与强 snapshot | 同上；源/index 聚合复用同阶段 phase | beforePublish、目标与 owner absence、资源源证明、members、no-op 身份重备 | 完整新 layout/collection/candidate/index/retired identity；资源复制/源退出与恢复各时点 |
| DR discard（含 evolve 删除） | 严格来源/历史/最终图 | 共同队列验全部 before 与实际 written | archive/lifecycle 由 DR | members、共同 CAS；末条正式保留空 index |
| IR formal/candidate discard | collection 或候选范围/历史/资源/强 snapshot | 共同队列验全部 before 与实际 written | formal hook 后集合/index对照、fresh/post collection、资源/tombstone | 资源 copy/源退出/回退、精确 tombstone cleanup；candidate 不扩大无关全文范围 |

所有场景保持 canonical/missing/NOFOLLOW/UTF-8、bytes/dev/ino/mode/完整父链、权限/umask、实际写入 handle、所有权、CAS、cleanup failure truthful outcome。worker threshold、permission/input-type async 预选及 worker 生命周期不变。

共同契约候选比较：全局统一领域验证会丢失 IR 资源与 DR 生命周期；完全保持局部继续分裂相同调度；选择共享文件计划/安全 phase + 领域显式附加证明。计划归一化复用 journal 已有 unchanged 判据，不创造第二种变更含义。

## Risks / Trade-offs

- 先完成计划结构/权限检查再读取，改变“前项 filesystem 漂移与后项非法计划同时发生”的首错误优先级；所有原先拒绝仍拒绝且零写入，避免无效计划启动批量读取。正常领域计划不受影响。
- IR 旧来源文本 reread 以 dirname(file) 为根，不能冒充 collection 根 proof；新实现重新以真实 transaction root 安全读取，强于旧文本相等且必须符合 prepared guards。文件 inode/mode/父链变化可能更早进入领域 aggregate，而不再等 shared failfast。
- 同阶段观察并非非合作并发编辑隔离；所有实际写入、资源 copy/delete、恢复仍执行其独立 CAS，不把一次 phase 观察当长期新鲜度。
- shared queue 统一会影响其他共同事务消费者，必须两域全回归并检查真实 Node 分发闭包。

## Open Questions

独立测量在实现冻结后取得，性能结论不预填。IR discard 的 full collection 必须继续拆分“来源安全采集、图/资源计算、时点”，审查可证明同 root/path/完整facts的单阶段来源交接；不能仅以包含领域语义为由把全部重复读取视为必需成本。长期 Decision 是否需要新建：暂判现有共同 owner 契约的补齐不另建变更日志；若确立新的长期 proof 交接规则且既有判断不覆盖，再按门槛复核。
