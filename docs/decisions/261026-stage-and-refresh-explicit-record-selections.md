---
title: 按显式对象和范围刷新独立记录暂存版本
id: 261026-stage-and-refresh-explicit-record-selections
status: active
alignment: aligned
createdAt: 2026-10-26T08:26:52Z
purpose: 让两域暂存和重复刷新可预测，保留未选工作、资源安全及独立阶段保护。
background: 并行记录共享索引；HEAD基底会丢失未选暂存，整个工作区基底会夹带变化，身份与位置又须分别解析。
decision: 两域stage以pending为基底按显式ID和scope刷新完整所选版本；可信定位、局部内容验收与完整并发保护分别成立。
tags:
  - decision-records
  - investigation-report
  - responsibility-boundaries
  - validation-boundaries
  - version-control
relations:
  - type: 归并
    target: 260922-unify-record-pending-snapshot-scopes
    summary: 保留统一scope与结果协议并修订选择和验收范围
  - type: 归并
    target: 261004-stage-decisions-by-explicit-id-and-selected-scope
    summary: 保留稳定身份及显式选择并扩充可信pending定位
  - type: 归并
    target: 261022-refresh-selected-records-in-pending
    summary: 保留P-base与阶段保护，未选依赖改据发布索引
---

## 目的

- 在 `skills/decision-records/` 与 `skills/investigation-report/` 内维护可组合的对象级暂存语义；不改变其他 pending 消费者。

## 背景

- 统一 scope、Decision 稳定 ID 与 P-base 刷新分次形成；本判断以 pending 为基底，统一显式对象选择与 H/W/P 局部验收的责任。
- 对象已有暂存可被显式刷新；准备后发生的并发漂移不是静态冲突，仍须拒绝覆盖。
- payload 方向由[所选 payload 验收判断](261024-validate-record-stage-selected-payloads.md)独立拥有；本判断收束选择、结果与完整刷新义务，不替代它。

## 决策

### 对象级刷新与 scope

- 采用: 两域使用 `stage <selector...> --scope all|index|domain`，默认 `all`。
  - 以本次捕获的 P（Git pending）为基底，指定 scope 内所选 ID 取当前完整版本，未选条目保留原 P。
  - 对象级替换不做字段或正文片段合并；索引投影和对应 source revision 一起刷新，重复选择可覆盖该对象既有部分暂存。
- 采用: 各 scope 分别承担以下写入范围，结构化结果列实际写入路径、保留范围与调用方配套责任；成功只证明 scope。

| scope | 写入范围与配套责任 |
| --- | --- |
| `all` | 原子组合所选发布投影与领域文件。 |
| `index` | 只刷新索引、不读工作区正文；调用方配套正文和资源验证与暂存。 |
| `domain` | 只刷新所选正式正文及调查 owner 资源，保留 P 索引原字节或缺失状态。 |

### 身份定位与索引前提

- 采用: 从固定 HEAD（H）、工作区（W）、P 的可用发布定位与必要的所选 canonical 路径解析完整 ID 或唯一 name；候选排除。
  - 位置或 basename 变化选同一 ID，删除选旧 ID，身份更正同选旧、新 ID。
  - 不因关系、名称相似或命令历史扩大选择。
- 采用: H/W 合法索引与可信 canonical locator 提供必要身份。
  - 合法 P 索引为所有所选 ID 补齐旧 sourcePath，即使 H/W 已出现身份；所选 canonical pending 路径也始终核对。
  - 仅 P 存在的任意旧 basename 丢失全部可信索引定位时显式恢复，零覆盖 pending。
  - 不扫描全部 blob 猜 ID，不发现全部未同步身份，不建持久 locator 清单。
- 采用: H/W 发布索引合法；`index`、`all` 还验 P 索引及三方集合 metadata、sourceRevision.metadata、definition 一致。
  - 确无 HEAD 正式成员且 P 无索引时才从空基底组合。
  - 历史正式成员缺索引，或已有 H 索引而 P 删除索引，须显式恢复；不重建全部 HEAD 正文兜底。
- 采用: `domain` 仅对 P 索引自身读取或解析失败容错，且其他可信定位须已足够；不豁免已定位所选正文身份、路径或读取失败。成功读得的 P 索引原字节纳入 opaque 及独立 fresh，P 索引状态保持。

### 所选正文、资源与组合图

- 采用: `all`、`domain` 现存所选正文须匹配 W 发布投影，合法手改先同步。
  - Decision 领域文件是所选正式 Markdown。
  - Investigation 还处理 H/P/W 所选 owner 路径并集的完整资源树，包含未引用及待删除旧成员；未引用旧成员可合法删除。
  - 所选直接资源实际读取验证；其他 owner 的正式声明只据索引验证，不额外读未选依赖正文或自动暂存其他 owner。
- 采用: 合成索引完整验证集合 metadata、definition、关系图和 owner 声明；缺依赖要求显式补选。
- 采用: 资源读字节前，在准备及写前分别检查根、owner 和全部路径分量，空树也执行；拒绝不安全、非普通或不符合领域成员可见性要求的成员，执行位尊重 Git `core.fileMode`。

### 独立阶段保护与 payload 验收

- 采用: 准备和写前独立捕获可变所选来源、W 索引、资源成员及完整受管 P 身份；锁内固定 HEAD 指针与完整 P 作 CAS，写后独立验收目标和范围外保护。
  - 所需读取失败或漂移时停止，`unchanged` 也适用。
  - 保留未选路径、mode、OID 及 staged 删除；JSON 可规范化，但未选条目含义保持。
- 采用: 按 scope 只验实际消费的索引、所选正文、直接资源和必要定位 payload；未选 payload 只保证完整身份保持，不冒充即时可读或有效内容指纹。
- 采用: 依索引扩展内容选集时，证明同 repository/scope、完整成员与既读 payload 未变；扩展不替代写前独立捕获或放宽普通快照相等。
- 采用: 同次调用可复用已证明等价的不可变解析与固定 revision 的 H 元数据、owner 成员。
  - W 成员、字节、表示及 P 仍按阶段重取；fileMode 关闭时只复用同阶段完整表示依据。
  - 不引入跨调用缓存，无关反馈只用变更元数据；完整索引、图及 P 保护仍有集合成本。

### 领域、共享层与调用边界

- 采用: 领域层拥有身份、资源与生命周期语义，经现有 Index Runtime 协调器复用阶段义务；共享层仅处理已解析路径及原子 pending replacement，通用 Index Runtime 默认完整验收不随两域放宽。
- 采用: `stage-index` 为普通未知命令，不保留迁移别名。
- 采用: 各 scope 只构造 pending，不改工作区来源的字节或表示；`stage` 不执行 sync、publish、生命周期、关系或 alignment mutation、commit 或 push，建立事实仍由工作区生命周期表达。
