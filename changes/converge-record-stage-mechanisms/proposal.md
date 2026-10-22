# Proposal

以 Decision Records 与 Investigation Report 的 `stage` 为第一个收敛切面，形成共享机制、共同决策与领域适配边界。用户已授权按本计划实施、验证、结项提交及正常 hook 推送。

## Why

实施前，两域已共享 pending snapshot／patch 和索引投影原语，也采用“pending 为底、选中完整刷新、未选保持”的语义，但阶段编排分别维护。Investigation 的 index scope 已按消费路径验收 payload 并复用准备阶段 pending；Decision 仍全 scope 验收且重复准备、阶段内再次捕获。继续各自优化会使相同阶段保护与成本策略再次漂移。

收敛应集中真实共同责任，而不是统一领域规则或引入另一套缓存、通用记录引擎。先对齐 stage，其他操作另行判断。

## Outcome

两域 stage 通过同一内部 owner 执行共同 scope 策略和阶段顺序，领域只保留自身选择、合法性、来源与资源适配；除下述明确列出的 index payload 验收变化外，保持公开命令及领域保证，并用 1W 存量、常数选择实测成本变化。

## Scope

### Intended Change

- 收敛三方发布投影兼容检查、P-base 选中刷新、scope 分流、阶段事实复用与重新获取、pending CAS 和结果事实接线。
- 将两域 `index` scope 统一为完整受管 pending 身份保护加所需索引 payload 验收；`all`／`domain` 继续完整受管 pending payload 验证。
- 沿用 `tools/index-runtime/` 与 `tools/shared/` 的现有分层，新增共享接点仅承接两个现有消费者的共同阶段责任，领域差异通过窄适配保留。

### Resulting Impacts

- 同步实际受影响的领域操作契约、工具维护说明与共享实现边界；实施时按决策规则扩展目前仅适用于 Investigation index payload 的判断，完整继承仍有效含义。
- 增加两消费者配对的共同契约证据，保留各自特有边界和现有输出字段语义；测试变化同步 Case 与索引。
- 审计共享源码的生成、分发、独立版本及门禁订阅影响，按实际影响更新，而非机械要求所有版本加一。
- 后续实施以正确性测试、独立后验和 1W 对照测量共同验收。

## Success Criteria

1. 共同机制及阶段顺序只有一个实现 owner，不是在两处复制同形流程；领域差异仍由各自 owner 验收。
2. 两域均保留连续暂存 A、B 后重选 A 的语义，B 的 pending 字节、表示与 staged 删除保持；scope 外内容不夹带。
3. 两域 index 采用同一明确 payload 边界；all/domain、独立 fresh 复核、锁内 HEAD/P CAS、写后验证和 unchanged 路径保护不削弱。
4. 原命令、参数、输出形状和非本次明确改变的失败／恢复保证保持，其他 Index Runtime 消费者继续原默认契约。
5. 1W 实测有可比较 baseline、wall／CPU／峰值 RSS、工作量采样及独立后验；Investigation 无显著回退，Decision 收益据实报告，不预设固定提升。
6. 受影响测试、生成、Case、版本与 owner 同步完成，阶段审查仅核对正确性；最终以编码规范为权威完成独立代码优化、AI-ready 文档优化及必要重验，并通过 `bun run check:changed`。

## Affected Owners

- [Index Runtime](../../tools/index-runtime/README.md)：索引投影与新增内部记录阶段接点；通用 selected stage 默认保持。
- [版本管理中间层](../../tools/shared/version-control.md)：pending 身份／payload／替换与恢复责任，Git adapter 不理解记录身份或 owner。
- [Decision 工具维护](../../tools/decision-records/README.md)与 [Investigation 工具维护](../../tools/investigation-report/README.md)：各自领域适配与入口。
- 两域 [Decision 暂存操作](../../skills/decision-records/references/cli-operations.md#待提交快照)、[Investigation 暂存操作](../../skills/investigation-report/references/cli-operations.md#待提交快照)及其领域规则、分发入口。
- [独立暂存判断](../../docs/decisions/refresh-selected-records-in-pending.md)、[两域 payload 判断](../../docs/decisions/scope-record-index-payload-validation.md)及其 [Investigation 前序](../../docs/decisions/archive/scope-investigation-index-payload-validation.md)、[统一 scope 判断](../../docs/decisions/unify-record-pending-snapshot-scopes.md)；[局部维护判断](../../docs/decisions/separate-record-local-operations-from-collection-audits.md)限定本次不扩展到其他操作。
- [编码规范](../../docs/coding-style.md)：整体变更与直接影响边界的代码质量权威；周边历史代码仅作事实参考，不替代规范。
- [项目工具链](../../docs/tooling.md)、[Test Evidence Review](../../skills/test-evidence-review/SKILL.md)：生成、版本、门禁及测试账本影响。
