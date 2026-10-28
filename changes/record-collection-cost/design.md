# Design

以阶段内索引及固定 revision 批量读取减少重复工作，保留事务观察边界。

## Context

审计按机制与站点而非独立缺陷计数；历史附件保持原样。每次 fresh 或恢复仍读取自身当前事实。既有决策 `261026-search-published-scope-with-current-text` 与 `261003-separate-record-search-coverage-from-preview-budgets` 已确立按需读取和扫描覆盖，`261026-stage-and-refresh-explicit-record-selections` 已确立 pending 基底与阶段保护；本轮细化行为 owner，不新增重复判断。

## Goals / Non-Goals

完成已授权的确认冗余和批准取舍；不添加 fast/unsafe 模式，不扩大为全部正文读取或额外重构。

## Decisions

### Intended Change

索引维持首匹配和原遍历顺序；同阶段可信纯派生可复用，跨阶段不得复用旧观察。Git 按固定 revision 与必要路径批量读取，pending 差量保留未变项标志，变化项交由 Git 正常更新。搜索预先校验显式输入语法，对实际访问对象执行身份与路径安全验证，并如实报告不完整和下界。

### Resulting Impacts

搜索契约需区分扫描、结果与预览完整性；索引写入验证保留 CAS、范围外保护与写后验证。精确 metadata 计数、content 截断和 Unicode 匹配不变。依赖不同阶段事实的计算必须分别建索引。受影响测试、账本和分发产物同步。

## Risks / Trade-offs

未访问对象不承诺发现其非法状态；变更条目不能盲目保留不兼容 Git 内部标志。Linux 结果不能证明 Windows 外部耗时消失。

## Open Questions

无需要用户决定的问题；实施中如出现会改变批准语义的事实须重新判断。

## Implementation Observations

- DR 的 selector、候选成员、维护 records/group、history、new 关系和 stage locator 使用各次操作内的索引；IR 的 selector、publish、stage、资源 owner 和关系写入同样按准备、fresh 或恢复各自建立。不得用准备阶段索引替代 fresh 事实。
- IR Git 资源 owner 在准备时分组；`evidence/owner-probe.mjs` 对 1,000 成员和 100 owner 对照完整结果，按旧遍历结构模拟 100,000 次，新函数遍历 1,000 次。根级非 owner 成员及相似前缀由真实 Git 回归覆盖。
- 图的 `evidence/cycle-probe.mjs` 对旧源码和当前源码的 1,000 节点、998 回环做隔离插桩；旧栈定位扫描 499,499 个位置，新 Map 查询 998 次，诊断逐项相同。普通 trace 的 100 节点测试核对邻接读取 100 次。
- metadata 通过仅身份匹配保留精确计数；两域各 100 命中的测试记录 grapheme 分段 0 次。内容预览在首个多余范围后不再物化其他行；1,000 行样例只对两行计算范围。单个已访问命中行仍完整合并其范围。
- 固定 revision 精确路径批量采用延迟错误与回退；根版本门禁按 skill 的合格路径、最多 32 条窗口按需准备。未暂存的 HEAD pending 输入上，`bun run hash:skills --quiet` 的 Git Trace2 `start` 为 223 次（`rev-parse` 112、`ls-files` 1、`cat-file` 55、`ls-tree` 55），历史同入口为 4,036 次。窗口大对象总量超过 256 MiB 的 batch 限制时逐项回退，可能先承担一次受限的失败准备。此计数不证明待提交快照或 Windows 时延。
- Git pending 实际差量只发送变化及删除项，N=10/1,000 的测试均为两条；真实 Git 测试覆盖未变 skip-worktree、已变 assume-unchanged、no-op 和 split index。CAS、保护与写后验收仍是独立阶段。
- 通用 selected 的完整候选比较保持未选变化保护，本轮不声称其比较算法已优化。canonical 重复、query-fields、重划合法事务、复杂 trace 排序、hash-object 同字节去重及并发不是已证明的本次修复，未纳入实现。部分私有索引站点以源码对账、既有语义测试和共享机制证据支撑，不能声称每站均有独立动态计数。

- 稳定输入的 `bun run check:changed` 实际通过 66 项，3 项发布专属检查不适用；结果位于 `.log/vibe-check/invocations/20261028T050255513Z-145b2812-6475-4015-93ad-80b1c4b690f5/`。门禁后只更新本计划的完成声明；暂存后的版本门禁与最终提交、计划安全退出由主代理处理。独立代码、测试及 AI-Ready 文档审阅均已完成；Windows、权限受限用户与真实发布环境仍未验证。
