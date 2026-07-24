---
title: 使用 Frontmatter 投影与语义字段顺序
status: active
alignment: aligned
createdAt: 2026-07-24T06:30:20Z
purpose: 让决策文件的结构化投影集中可读，并让单条索引记录按语义块稳定排列。
background: 正文中的索引摘要和关系分散了结构化字段，递归字典序又会拆开相关字段。
decision: Frontmatter 保存文档自有投影字段，索引对象使用固定语义字段序，条目仍按 ID 排序。
relations:
  - type: 修订
    target: decision-records/generate-index-from-self-contained-decisions.md
---

## 目的
- 让每条决策文件自包含全部权威状态，并让生命周期、标题、索引摘要和直接关系集中在 Markdown 开头。
- 让 JSON 索引的外壳、查询键、领域状态和关系对象按各自语义块稳定输出。
- 让集中索引只承担可无损重建的查询投影，不成为需要与 Markdown 分别维护的真相源。
- 保持索引条目按稳定身份排序，不让复杂关系图承担默认排列责任。

## 背景
- 当前 Frontmatter 只保存生命周期字段，标题和三项索引摘要来自正文，直接关系还使用独立 Markdown 章节。
- 当前通用索引规范化会递归按字段名字典序排列对象，导致生命周期、身份、摘要和关系字段互相穿插。
- 生命周期、对齐状态、创建时间和决策语义都属于单条决策自身；集中索引应能删除后仅凭决策文件完整恢复。
- 决策路径已经以主题目录作为稳定身份的一部分；条目按 ID 字典序足以让同主题记录尽可能相邻。
- 决策关系可以形成分支、归并和跨主题连接，不存在始终清楚且低成本的单一图排序。

## 决策
- 采用: 每条决策 Markdown 自包含全部权威状态；Frontmatter 按固定顺序保存 `title`、`status`、`alignment`、`createdAt`、`purpose`、`background`、`decision` 和 `relations`，正文继续承接完整目的、背景和决策。
- 采用: `status` 只能是 `active` 或 `archived`；活动记录的 `alignment` 只能是 `aligned` 或 `unaligned`，归档记录的 `alignment` 必须是 `null`。
- 采用: `createdAt` 是首次激活时写入决策文件的不可变秒级 RFC 3339 时间，带显式时区且不含小数秒。
- 采用: `purpose`、`background` 和 `decision` 是受长度约束的索引摘要，必须与对应正文语义一致；`relations` 保存作者声明的直接关系。
- 采用: `path`、`topic`、`pending`、索引 `id`、查询 `keys` 和 `sourceRevision` 继续从路径、Git 或文档内容派生，不在 Frontmatter 重复保存。
- 采用: 决策继续使用 `<topic-id>/<semantic-slug>.md` 作为稳定身份；集中索引登记全部活动和归档记录，并完整投影 Markdown 中的当前事实。
- 采用: 集中索引不拥有独立事实；正常维护不直接编辑索引，CLI 从全部有效决策文件生成、严格校验并写回完整索引，删除索引后仍可无损重建。
- 采用: JSON 索引外壳、key 定义、单条 state 和关系对象分别使用固定语义字段顺序；未知字段仍由严格 Schema 拒绝。
- 采用: 索引条目继续按 `id` 字典序输出；关系数组保持作者顺序，关系图只用于关系校验与追溯，不参与默认条目排序。
- 采用: 实现只承接当前 Markdown 格式和当前索引 schema，不读取旧格式、不提供兼容映射，也不为缺失字段设置默认值。
