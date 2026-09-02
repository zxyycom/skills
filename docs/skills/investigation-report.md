# Investigation Report

`investigation-report` 用一份可独立阅读的报告保存**一轮调查在形成时的认识**：为什么调查、检查了什么、依据是什么、得出了什么，以及结论不能说明什么。它让后来者即使没有原对话，也能复核这轮认识及其与其他调查的演进关系。

它不是当前事实、长期决策、实施计划或任务状态的载体。代码、规范和配置仍拥有当前事实；长期采用方向交给 Decision Records；需要实施时交给 Change 或 Task owner。调查得出下游判断或任务，不会自动授予采用或实施授权。

本页提供人类的定位和理解路径，不是 agent 执行入口，也不重复固定格式或 CLI 契约。创建、更新和审阅时从 [`skills/investigation-report/SKILL.md`](../../skills/investigation-report/SKILL.md) 开始；报告身份、候选、目录、字段、关系事务、资源路径、索引和命令的精确规则以[固定契约](../../skills/investigation-report/references/investigation-report-contract.md)为准。

## 何时使用

仅当用户明确要求把一轮调查**记录或沉淀为报告**，或明确要求创建、更新或审阅调查报告时使用。普通调查、排障和问答在当前工作中完成即可，不因可能有用而自动建立报告。

适合沉淀的最小对象是“一轮可以独立汇报的认识”，而不是一次命令、一个来源、一个试错步骤或一条待办。新证据、不同环境下的复查或实质认识变化通常构成新报告；只有原报告没有准确保存当时认识，或有格式、链接等记录错误时，才原地修正。

## 正式集合与候选 workspace

所有**已建立**报告都是同一正式集合的成员。每份报告以稳定 Investigation ID 定位，改名表示身份变化；单份正式 Markdown 是这轮调查语义的权威来源，索引是从全部正式报告重建的查询适配层，资源是报告按需声明的形成时材料。关系演进不会归档或删除报告；只有明确要求剔除报告时，才通过独立的 `discard` 事务处理删除边界。

authoring candidate 是根目录保留文件 `_candidate.<investigation-id>`，不是正式报告、索引 entry 或 lifecycle 状态。它让正文、资源和关系先在集合外收敛；候选与正式报告同处调查根目录，因此两者都使用不变的 `./_resources/<resource-id>` 链接。候选自己的资源可以先放入最终 owner 路径，也可以共享既有正式资源；publish 不改写正文或搬迁资源。

```text
后继正式报告 ──“补充 / 复查 / 修正 / 推翻 / 归并 / 拆分”──> 直接前序正式报告
      │                                                              │
      └────────────────── 所有正式报告留在同一集合 ──────────────────┘

_candidate.<investigation-id>  ── publish（显式选择）──>  <investigation-id>
        authoring workspace                              正式报告 Markdown
                                                        │
报告 Markdown（权威：问题、形成时内容、tags、关系、资源引用）
    ├── 可选：形成时资源（支撑材料；资源本身不是报告正文）
    └── 重建 ──> investigation-index.json（发现、筛选、排序与 trace 的派生适配层）
```

这个模型有四个容易混淆的边界：

1. **candidate 不等于已建立报告。** `scaffoldValid`、`bodyReady`、`resourceReady` 与 preflight 仅报告机械准备状态，不证明调查结论、关系语义、资源价值、语义审核或 publish 授权。
2. **关系不产生生命周期。** 即使正式报告被修正、推翻或已有后继，它仍保留在正常发现路径中；没有归档目录或“被替代即隐藏”的机制。显式 `discard` 是独立的破坏性维护动作，不是关系的自动结果。
3. **publish 是正常入口，不是唯一建立机制。** `publish <id...>` 只建立显式选择且通过完整预检的 candidates。手工写入正式根目录的完整报告仍立即属于正式集合，但只能由 `sync-index` 的全量验证与重建显式接纳；publish 不会静默混合这种来源漂移。
4. **索引不是第二份事实。** 它方便发现、过滤、排序和追溯关系，但不能取代正式报告 Markdown；索引缺失、过期或异常时，不应把旧投影当作正式集合事实。合法 candidates 不进入索引、正式查询或 `stage-index`。

## 一份报告应让读者恢复什么

一份完整报告要让读者恢复形成时背景、调查目的、范围与依据，以及结果与边界。它应说明哪些是确认事实、基于证据的推断、建议、实际动作和未知；证据范围、方法和条件要足以判断主张强度。资源或相邻报告不能替代这些正文语境。

计量、因果和方案类结论还应保留会改变解释的条件，例如样本和误差、候选解释和反证、授权、恢复与验证边界。固定章节、frontmatter 和字段排序是可机读的稳定契约，以[固定契约](../../skills/investigation-report/references/investigation-report-contract.md)为准。

## 分类、演进与资源

`tags` 只回答“这份报告属于哪些可检索分类”，不表达状态、当前有效性、时间顺序或关系。关系只回答“本轮认识如何直接承接更早的认识”：它从后继指向真实直接前序，使用补充、复查、修正、推翻、归并或拆分之一；不表示任务依赖、优先级、授权或当前结论。关系的具体选择由 skill 指导，合法图形与事务由固定契约承接。

资源是按需声明的形成时材料。只有正文与稳定事实 owner 无法充分支持未来复核时才保留，并且仍须在正文说明其来源、条件和支撑作用；秘密、认证材料或其他不应入库的信息不得保存。资源归属、共享引用和路径规则以固定契约为准。

## 维护入口与审阅结果

常规创建先以 `new` 得到 candidate。创建成功即使正文尚未完成或辅助检查有 warning，也不应重跑 `new`；继续编辑、用 `show-candidate` 查看，或以 `publish --preflight` 只读预演最终集合。预检不保存 receipt，普通 publish 会重新读取所有相关事实；只有当前授权与人工语义审核都完成后才执行 publish。

`sync-index` 是正式集合级的低频重建和显式接纳入口：一批手工正式报告编辑可以先共同完成，在查询、关系事务、全量检查或交付需要当前索引前统一同步一次。只读审阅不会为修复索引而写入；索引缺失或过期时应报告这一缺口，而不是把旧投影当作集合事实。合法 candidates 不会被 `sync-index` 接纳，也不进入正式 `list`、`show`、`trace` 或 `stage-index`；`candidates`、`show-candidate` 和显式选择它们的 `publish` 才会读取候选。

审阅完成时，应能判断正式报告是否仍可独立复核形成时认识，tags 与关系是否各有内容依据，资源是否必要且安全，以及正式报告、索引和关系图是否没有被误读为当前决策或实施状态。调查如形成长期采用方向、实施任务或稳定测试义务，再交接给对应 owner；没有下游载体不影响报告本身成立。

## 运行时诊断与恢复

CLI 将成功信息写入 stdout，将失败与 warning 即时写入 stderr。诊断说明 code、对象、原因和下一步；有可靠系统证据时才附带原因类别、操作和经过净化的 detail。即时诊断不会持久化为报告、索引日志、遥测或 receipt。

只有 mutation-capable 命令的失败，才为各自可证明的范围报告 `no-change`、`rolled-back`、`partial-or-unknown` 或 `committed-cleanup-pending`；普通读取、检查与参数错误不附带这些字段。`new` 成功后的 readiness warning 与 `publish --preflight` 都不是 mutation outcome。`sync-index`、`set-relations`、`discard`、`publish`、`discard-candidate` 和 `stage-index` 分别只声明自己实际拥有的 mutation 范围。恢复不完整时保留来源并停止对账；权限问题只授予当前进程，busy 时先等待或确认活动进程。工具不会使用或建议 `sudo`，也不会自动删除锁或重试。精确诊断字段和恢复动作由[固定契约](../../skills/investigation-report/references/investigation-report-contract.md)及[维护恢复](../../skills/investigation-report/references/maintenance-recovery.md)承接。
