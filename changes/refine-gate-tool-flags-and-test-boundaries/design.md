# Design

以独立工具能力输入和原生 flag 组合表达触发，以测试的不可替代观察选择最小验证边界。

## Context

Gate 已使用 Vibe Check 0.0.4 的原生命令、智能调度与私有发布交接。
本 Change 的问题是领域级输入闭包与支持文件的 CLI 顶层导入共同扩大影响范围。
两领域 611 个原生节点是证据基线；逐项审计负责解释每个原节点的最终后继及必要观察。

## Goals / Non-Goals

- 目标：能力输入、Check 订阅、成功证明与实际执行一致；明确保留、下沉、合并和补强的证据。
- 目标：小工具 flag 可被多个 Check 直接订阅，原生机制继续负责选择、依赖、调度与结算。
- 边界：复用现有原生选择与每 Check 成功证明，不新增 runner、工具成功缓存或自动语义依赖推导。代价与收益以相同场景的实测评价。

## Decisions

### Intended Change

1. `impact-tools.ts` 按独立源码职责维护能力 ID 与 patterns，内部 flag 派生为 `gate-tool:<toolId>`。语义与包脚本 catalog 显式声明订阅，原生 `any(...)` 与 `propagateDependsOn` 负责选择和成功前置。
2. 共享搜索输出源码与两份分发副本属于同一能力，按真实消费者订阅；基础文本搜索不因输出渲染变化整体失效。共同配置和宽消费者仍保留完整输入。
3. 同一每 Check receipt 保存完整指纹与 `toolFingerprints`；两者精确匹配才形成复用候选。共享 flag 和成功前置带入项均计 execute，全部 passed 且最终成功、起止无漂移才发布。全局契约与逐 Check 版本承担证明失效；精确形状由[工具链](../../docs/tooling.md#项目输入与成功证明)维护。
4. fixture-only、CLI、Git 支持按实际职责分离，再核对订阅。两领域未归属文件检查只发现 `src/`、`tests/` 遗漏，完整 import 与动态读取依赖仍由人工审查。
5. 每个原生节点逐项回答“降层后丢失什么不可替代观察”。规则矩阵保留低层完整性，上层保留独立外部边界证据；Case 维护长期证明，`boundary-audit/` 保存本轮原 ID 到最终后继的短期逐项依据。

#### 实际加载与验证边界

| 承载 | 验证责任 | 加载与订阅 |
| --- | --- | --- |
| Investigation Report 的四个非 CLI 容器 | 记录/资源、索引/查询、维护、暂存 | 使用领域/API 及必要真实状态，不加载完整 CLI、搜索输出或生成物。 |
| Investigation Report CLI 容器 | source/generated CLI 与必要真实 Node 分发 | 加载完整 CLI，订阅全部实际能力并依赖统一生成 provider。 |
| Decision Records record / pending-stage | 记录/图与暂存 | 使用领域/API，不加载 CLI。 |
| Decision Records query / lifecycle | 查询、生命周期及保留的源码 CLI 接线 | 仍加载源码 CLI，完整订阅其加载闭包，包含搜索输出。 |
| Decision Records public-distribution | CLI 与生成物分发 | 唯一消费本领域生成物的容器，依赖统一生成 provider。 |

### Resulting Impacts

- 同步输入证明契约、执行/复用诊断、项目测试及 Case/index；完整 Definition 仍为 64 项。
- 必要内部源码调整保持实际生产调用和公开边界，分发字节变化按现有版本规则同步生成物。
- 验收顺序、完成状态和已运行证据由 [tasks.md](tasks.md) 承接；长期接入规则归[Gate 编写 owner](../../docs/gate-check-authoring.md)。

## Risks / Trade-offs

- 输入收窄以真实加载与读取闭包为依据；源码 CLI 中未调用分支的静态 import 仍是输入。
- 文件系统身份、权限、漂移和事务恢复保留必要真实外部观察，规则矩阵下沉不替代这些证据。
- 共享 flag 可能保守带入已有精确证明的其他订阅者，接受少量扩散以保持模型简单，实际执行必须可见。
- learned 调度、四项并发上限与资源硬约束、环境前置、CI/cold 全执行及发布同快照事务保持。

## Open Questions

无。完整 Gate、最低支持 Node、冷 release 与同机场景均已验收，实际结果与未覆盖平台见[验收记录](verification.md)。
