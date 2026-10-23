# Proposal

本实施计划让两种记录工具的共同操作只有一份维护实现，显式保留领域差异，并以分批替换和有限验证兑现已确认的产品保证。

## Why

Decision Records（下称 DR）与 Investigation Report（下称 IR）已经共享派生索引、
图遍历、文本搜索与暂存协调，但非 stage 命令仍由两域独立编排。
同一阶段已严格取得的索引、源字节、身份映射或查询上下文未持续传给消费者，
共同操作因而重复准备，也容易在完成事实、错误门槛和恢复保证上分叉。

当前问题不只是性能：IR trace 在缺失关系目标的损坏发布图上可能返回成员不闭合的
成功 envelope；IR new 在已创建候选、随后解锁失败时可能丢失实际创建事实。
这两项属于结果纠错；查询图门禁、候选知识和普通事务保证按已确认的
[五组产品保证](design.md#产品保证)实施，分别验收纠错、同保证复用与产品改变。
关键依据、稳定源码接点和证据边界见 [design 的 Context](design.md#context)。

[局部操作与全集验收决策](../../docs/decisions/separate-record-local-operations-from-collection-audits.md)
已区分发布基线、局部当前来源与全集健康；
[仓库模型](../../docs/repository-model.md)要求 skill 独立选择和分发。
本 Change 在这些边界内收敛实际共同责任，不引入缓存体系或新的通用记录平台。

## Outcome

完成实施后，同一种共同操作由一个明确 owner 维护顺序、证据交接和失败处理，
两域在共同阶段内提供各自定义、所需领域事实、合法性与结果映射；修改共同保证不再分别修改两份流程。
领域独有行为仍能独立表达，现有两个 skill、CLI、公开程序化边界与持久索引格式保留。
每个替换切面都有正确性、恢复与 1W 存量常数小操作的验收证据，旧实现随该切面退出。

[任务清单](tasks.md)拥有实施与验收进度；计划审计不代表产品验收，实施和版本保存服从接手时的授权。

## Scope

### Intended Change

1. 新增 `tools/record-operations/` 作为仅服务 DR、IR 两个现有消费者的共同操作 owner；
   统一操作编排本身，不只提取 helper 后让领域重新拼流程。
2. 分切面接入 check/sync、正式查询与安全读取、候选与 readiness、publish/set-relations、
   严格 rename/discard；DR 独有生命周期事务只复用真实共同的安全事务机制。
3. 共同操作内交接同调用、同阶段、同 definition 与同不可变事实的准备结果；
   sync 和写事务继续独立 fresh 验收，不把早期 snapshot 当作后期事实。
4. 按 [design 的产品保证](design.md#产品保证)落实已确认的查询/check、候选、事务与安全边界；
   纠错、同保证机械复用及产品改变分别记录行为与成本，并在实际改变的批次同步稳定 owner。
5. 用一份共同契约测试分别运行两域适配器，保留领域及公开入口集成证明；
   按 [分批替换顺序](design.md#resulting-impacts)逐批删除退役流程并同步直接影响。

### Resulting Impacts

- 新操作 owner 的源码、依赖和职责需进入项目导航、工具链及局部维护说明；
  Index Runtime 仍只拥有派生索引协议，已有 stage 协调器保持原位与已验行为。
- 产品保证改变涉及现行有效决策、两域规则/操作/恢复契约、help、公开声明及测试的相应投影，
  由对应实施批次同步。
- 两个独立生成闭包可以各自包含共享源码副本，维护源必须唯一；
  构建映射、分发依赖、skill 版本和相关生成检查随每批同步。
- 新增或改动测试时按 Test Evidence Review 更新对应单 Case 文件与派生索引；
  不为尚无测试入口支撑的计划工作预建 Case。
- 需要协调的具体决策及帮助、维护工作流投影见 [design 的文档影响](design.md#文档决策与分发影响)。

## Success Criteria

1. 每个共同命令族可定位唯一编排入口；两域适配器不再拥有同形准备、fresh、发布或恢复顺序。
   真正领域独有行为有明确理由和 owner，不靠开放 callback/flag 隐藏第二套共同流程。
2. 两项已复现结果错误有定向回归证据；五组产品保证都有行为 owner 和直接证明入口，
   包括无关系 content 不强制验整图、首次采集 check 与事务真实结果，不以重构名义偷换保证。
3. 准备复用绑定身份、definition、原始字节及必要严格证明，保留错误优先级、
   未选保护、独立 fresh、写后验收与恢复归属；合法空集合和真正 no-op 有直接证明。
4. 同保证机械替换不出现稳定性能回退；保证改变按已确认取舍单列行为和成本，不计为等价加速。
   使用 10,000 条存量、单条或常数小批输入，按 design 的有限代表采样完成配对比较；不承诺固定倍数。
5. 每批旧路径和失去消费者的 helper/测试即时删除，不保留长期双轨、fallback 或功能开关。
   最终盘点全部非 stage 公开命令族与直接调用点，两个 skill 均能独立生成、安装和运行。
6. 受影响规则、决策、CLI/SDK、生成物、版本与 Case 完整同步；实施收尾通过相应工具检查及
   `bun run check:changed` 或 CI 全量门禁，并报告已运行与未覆盖的边界。

## Affected Owners

| Owner | 本 Change 的职责或必要影响 |
| --- | --- |
| [项目导航](../../docs/navigation.md)、[工具链](../../docs/tooling.md#源码与依赖边界)、[编码规范](../../docs/coding-style.md) | 新操作 owner、依赖方向、生成与验证入口 |
| [DR Skill](../../skills/decision-records/SKILL.md)、[操作契约](../../skills/decision-records/references/cli-operations.md)、[工具维护](../../tools/decision-records/README.md) | 决策语义、公开行为、领域适配与实现 |
| [IR Skill](../../skills/investigation-report/SKILL.md)、[操作契约](../../skills/investigation-report/references/cli-operations.md)、[工具维护](../../tools/investigation-report/README.md) | 调查语义、资源责任、公开行为与领域适配 |
| [Index Runtime](../../tools/index-runtime/README.md)、[shared](../../docs/tooling.md#源码与依赖边界) | 严格索引/reader/sync 证明交接；现有图、安全 I/O 与版本管理原语 |
| [DR 构建](../../scripts/build/decision-records.ts)、[IR 构建](../../scripts/build/investigation-report.ts) | 两个独立分发闭包、声明和生成检查 |
| [DR 恢复](../../skills/decision-records/references/maintenance-recovery.md)、[IR 恢复](../../skills/investigation-report/references/maintenance-recovery.md) | 候选身份恢复、提交/验收/清理事实、CAS 冲突与人工对账 |
| [Decision Records](../../skills/decision-records/SKILL.md)、[测试证据](../../skills/test-evidence-review/SKILL.md) | 实施时维护被改变的长期判断、最小原生测试入口与 Case 账本 |
