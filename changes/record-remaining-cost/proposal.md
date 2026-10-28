# Proposal

本 Change 收束四项已具机制证据的记录与检索成本优化；本文仅保存本轮实施范围。

## Why

[剩余成本调查](../../docs/investigations/261028-record-cost-reachability-boundaries.md)已证明 selected 比较、重划闭包、查询字段校验与长行命中生成存在可减少的工作。原型尚未覆盖完整生产接线及失败边界。

## Outcome

四项优化进入实际消费路径，以可复现测试证明减少目标工作且保留结果、诊断、顺序和安全边界；源码、分发与测试证据同步并完成审查。

## Scope

### Intended Change

依次实施 selected revision 差异短路和变化项排序、重划闭包集合查询、内部可信查询字段校验复用、长行按最终合并范围限量生成。

### Resulting Impacts

- 为每项优化补齐最小原生测试、真实消费接线和针对性回归证据。
- 同步受影响工具 owner、测试 Case、增量门禁路由和 skill 分发版本。
- 使用 AI-Ready Docs、Test Design 和仓库编码规范审查最终变更；按授权提交并结项。

## Success Criteria

- 目标工作减少有机制证据，不把局部计数推断为原 Windows 项目端到端收益。
- selected 未选保护、闭包诊断顺序、公开输入验证、Unicode 范围合并、截断与失败行为保持。
- 独立 Terra 审查无未解决阻断；适用本地门禁、生成一致性与暂存版本检查通过。

## Affected Owners

`tools/index-runtime/`、`tools/decision-records/`、`tools/shared/src/file-text-search/`，以及其实际消费方和项目测试、生成及门禁 owner；实现质量以 [编码规范](../../docs/coding-style.md) 为准。
