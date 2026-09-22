---
title: 为记录领域统一待提交快照范围
id: 260922-unify-record-pending-snapshot-scopes
status: active
alignment: aligned
createdAt: 2026-09-22T16:58:11Z
purpose: 让两个记录领域用同一 stage 命令和显式 scope 构造可预测的选择性 Git pending 快照。
background: Decision 已有完整快照 stage，Investigation 只有索引条目 stage-index；同名交付动作覆盖的领域文件不同，删除、重命名和 owner 资源也缺乏统一边界。
decision: 两域 CLI 共用 stage selector 与 all、index、domain scope；selector 在当前集合与 HEAD 基线并集中解析，结果返回实际写入路径与保留范围。
tags:
  - decision-records
  - investigation-report
  - version-control
relations:
  - type: 修订
    target: stage-investigation-index-entries-by-report-id
    summary: 保留按 ID 选择索引条目，把报告与资源暂存收口为显式 scope
---

## 目的

- 让 Decision Records 与 Investigation Report 的选择性 Git pending 快照使用相同的命令、selector 模型和结果协议，调用者可以仅凭输入预测成功后进入 pending 的路径。
- 让新增、更新、删除和重命名在两个领域使用同一选择语义，报告 Markdown、owner 资源与派生索引的写入边界显式可核对。
- 让 pending、commit 与 push 的责任继续留在调用方；stage 只构造待提交快照，不形成提交、发布或版本锚点。

## 背景

- 两个领域都能选择正式记录并更新待提交索引，但 Decision 的 `stage` 写入完整决策快照，Investigation 的 `stage-index` 只写索引条目；同名交付动作覆盖的领域文件不同。
- 删除与重命名要求同时覆盖当前集合与 `HEAD` 基线，Investigation 的报告还拥有完整受管资源目录子树，索引条目暂存无法表达这些领域路径。
- [按报告 ID 独立暂存调查索引条目](archive/stage-investigation-index-entries-by-report-id.md)确立了按 Investigation ID 选择派生索引条目的语义，但把报告 Markdown 与资源的暂存留给调用方手工选择，命令入口也只在 Investigation 存在。
- [为领域 CLI 统一工作区定位与帮助契约](unify-cli-workspace-location-and-help.md)已提供共同定位契约，索引陈旧门禁已提供同步集合与 mutation freshness gate；快照范围在此基础上收口。

## 决策

- 采用: 两域 CLI 共用 `stage <selector...> [--scope <all|index|domain>]`，默认 `all` 在一个原子替换中写入所选索引投影与领域文件；`index` 只替换 pending 索引投影；`domain` 只写入所选正式 Markdown 与 owner 资源并把 pending 索引按当前字节原样保留。
- 采用: selector 在当前正式集合与 `HEAD` 基线索引的 ID 并集中解析：当前 ID 表示新增或更新，基线-only ID 写入删除；重命名显式同时选择旧 ID 与新 ID，不从名称相似度推断；候选不进入 stage 范围。
- 采用: Decision 的 `domain` 覆盖所选正式 Decision Markdown；Investigation 的 `domain` 覆盖所选正式报告 Markdown 及其完整 owner 资源树，成员取工作区与 `HEAD` 的路径并集，未引用成员也进入范围，其他 owner 的资源保持不变。
- 采用: 所有 scope 都要求已同步且全量检查通过的集合，并在写入前验证 `HEAD` revision、现有 pending 快照、所选来源字节和 owner 资源成员漂移；结构化结果返回实际写入路径、保留的无关 pending 范围和仍由调用方负责的路径。
- 采用: 领域路径发现与正式来源有效性保持在各领域层，共享版本控制层只承接已解析受管路径的原子 pending replacement，不解释记录 ID 或资源归属。
- 采用: 被取代的 `stage-index` 公共入口只按普通未知命令处理，不保留别名、弃用分支或迁移专用提示。
- 不采用: 用 stage 执行同步、发布、生命周期 mutation、commit 或 push，或把领域选择语义上收到共享版本控制层。
