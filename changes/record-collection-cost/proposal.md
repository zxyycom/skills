# Proposal

消除记录工具已确认的集合成本，同时保持事务与搜索的明确边界。

## Why

形成时审计识别同阶段重复扫描、未消费计算和逐文件 Git 进程；具体证据见 `docs/investigations/261028-collection-single-item-cost-audit.md` 与 Windows 前序调查。

## Outcome

授权范围内的重复工作按阶段线性准备或批量读取，事务保护保持，搜索与 index 标志的批准语义得到实现和验证。

## Scope

### Intended Change

- DR 与 IR 的选择、候选、维护、关系和 stage 定位使用阶段内索引；IR 资源路径按 owner 一次准备。
- IR HEAD 前序及 skill 版本门禁固定 revision 批量读取；共享图回边、trace、搜索匹配和预览按需计算。
- 搜索按实际访问对象安全验证；pending 只更新变化条目。

### Resulting Impacts

- 保持独立 fresh、CAS、恢复、写后验收、未选保护、路径安全与未获批准改变的诊断顺序；同步行为契约。
- 验证 Unicode、精确计数、预算截断、Git flags/扩展与缺失/短路；同步必要测试账本及分发生成。
- canonical 重复、query-fields、重划合法事务、复杂 trace 排序、对象 hash 去重/并发不在本轮范围，除非证明必要且安全并先更新计划。

## Success Criteria

逐项闭合上述范围，语义回归和可重复工作量证据齐备；受影响 scope 门禁、代码规范、测试设计与文档审阅完成，交接平台及未验证边界。

## Affected Owners

`tools/decision-records/`、`tools/investigation-report/`、`tools/shared/`、`scripts/`；各领域行为文档、测试证据账本与分发入口。
