---
title: 按指定决策构造待提交快照
status: active
alignment: unaligned
createdAt: 2026-08-03T10:35:38Z
purpose: 让调用者从并行磁盘决策变化中选择可独立提交且索引一致的待提交决策集合。
background: 单一完整索引使普通路径暂存无法隔离并行决策，而生命周期命令只维护磁盘决策集合。
decision: 独立 stage 命令以 revision 为基线叠加指定 filesystem 变化，生成完整索引后替换 pending 决策范围。
relations: []
---

## 目的

- 让调用者从并行存在于 `filesystem` 的多个决策变化中，显式选择一个可独立提交的决策集合。
- 保持单一完整决策索引、`filesystem` 生命周期事务和版本管理 `pending` 事务各自的责任边界。
- 保证 `pending` 中的决策 Markdown、领域目录表和派生索引来自同一目标来源。

## 背景

- 本决策中，`revision` 是当前已提交的不可变版本，`filesystem` 是命令运行时磁盘内容，`pending` 是准备进入下一版本的完整快照；三者互不替代。
- 决策源集合由 `decision-domains.json` 和全部已建立决策 Markdown 组成；`decision-index.json` 是从这批来源生成的完整派生快照，其 `sourceRevision` 覆盖整个来源集合。
- 两个独立决策变化会同时改变聚合索引。普通路径暂存无法为其中一个决策重建合法完整索引，直接暂存 `filesystem` 索引又会带入其他并行变化。
- `activate`、`evolve`、`archive` 等生命周期命令直接维护 `filesystem` 决策文件及其索引，不读取、维护或区分 `pending`。
- 通用提交整理能力不拥有决策索引协议；共享版本管理层负责隔离底层版本系统并承接受控的 `pending` 写入。

## 决策

- 采用: decision-records 提供独立的 `stage <decision-path...>` 命令。调用者显式给出共同形成合法集合的决策根相对路径；生命周期命令直接维护 `filesystem`，不增加 `--stage` 选项。
- 采用: 目标 `pending` 决策源集合以完整 `revision` 来源为基线，只叠加指定路径的 `filesystem` 状态。`revision` 不存在而 `filesystem` 存在表示新增，两者都存在表示替换，只有 `revision` 存在表示删除，两者都不存在表示输入无效；重命名由旧路径删除与新路径新增共同表达。
- 采用: 未指定决策在目标 `pending` 中使用 `revision` 内容，其他 `filesystem` 变化保持在磁盘；既有 `pending` 不参与目标构造，决策范围外既有 `pending` 内容保持不变。
- 采用: `filesystem` 和既有 `pending` 中的索引都不作为目标索引输入。命令从目标领域目录表和目标决策 Markdown 生成、序列化并严格校验完整索引后，才请求共享版本管理层完整替换 `pending` 决策范围。
- 采用: 已存在决策基线时使用 `revision` 中的领域目录表；没有基线时才从 `filesystem` 引导完整合法目录表。指定决策依赖目标目录表之外的领域变化时失败，命令不静默扩展选择集。
- 采用: 输入无效、目标集合不合法、版本管理能力不可用或写入恢复失败时明确停止。命令不修改 `filesystem` 决策文件；本决策不要求 Git 以外的版本管理实现，decision-records 的接口和输出不得透传 Git 专属语义。
