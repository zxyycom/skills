---
title: 使用领域路径作为唯一一级分类
id: use-domain-paths-as-primary-classification
status: archived
alignment: aligned
createdAt: 2026-07-24T17:06:26Z
purpose: 让领域定义、记录归属和查询视图从同一权威来源确定，消除并行分类语义。
background: 领域同时存在于 frontmatter、历史目录和查询参数时，同一记录会有多个一级分类来源，读取方也无法直接取得领域边界。
decision: 由目录表定义领域，路径第一段表达唯一归属，索引 metadata 提供完整定义并从路径派生领域键。
tags:
  - decision-records
  - record-classification
relations:
  - type: 归并
    target: query-projected-decision-metadata
  - type: 归并
    target: use-frontmatter-projection-and-semantic-field-order
---

## 目的
- 让领域 ID、责任边界、记录归属和查询消费视图共享一个可校验的权威来源。
- 让每条决策只有一个一级分类，并使文件身份、关系目标和领域筛选使用同一路径语义。
- 让读取方能够从索引结果直接理解领域定义，不需要另外寻找目录表或猜测目录含义。

## 背景
- 受控领域适合表达决策主要改变的稳定责任边界，但把领域同时写入 frontmatter 和独立历史目录会形成两个归属来源。
- 保留与领域无关的一级路径分组，会让路径身份、物理组织和逻辑分类分别演进，迁移和关系维护成本持续增加。
- 可重复领域参数提供并集查询，却掩盖了单条决策应有唯一主要 owner；读取结果只显示 ID 时也缺少责任边界说明。
- 领域目录表已经能够集中定义 ID 与描述，schema v2 索引 metadata 能够为全部读取路径提供类型化集合级上下文。

### 形成时的职责承接

本次归并改变一级分类来源，保留当时的 Frontmatter 投影、格式与查询责任：

- **自包含投影**：Frontmatter 按 `title`、`status`、`alignment`、`createdAt`、`purpose`、`background`、`decision`、`relations` 集中保存文档自有事实。
  - 三项摘要须忠实于正文；派生 path、查询 keys 和 sourceRevision 不在 Frontmatter 重复维护。
  - alignment 的状态组合与不可变建立时间由当时固定契约验证。
- **格式与排序**：JSON 外壳、key 定义、state 和 relation 对象采用固定语义字段序，entries 按 id 字典序、关系数组保持作者顺序；图只参与验证与追溯，不决定默认排序。
  - 领域目录表和 metadata 的引入不把集中索引变成第二事实源，也不恢复递归字典序。
  - 精确格式及该时点的格式限定由当时 `skills/decision-records/references/decision-record-rules.md` 承接。
- **查询出口**：`list` 筛选投影，`show` 展开所选原文，`trace` 回放关系；默认 active、alignment 与时间展示、stdout 结果及 stderr warning 的结论边界保留。
  - 原 topic 筛选改为单个 domain，由目录表及索引 metadata 提供领域定义，不另建并行分类。

## 决策
- 采用: `decision-domains.json` 是领域 ID 和描述的唯一事实源；领域定义按 ID 稳定排序，并参与结构校验、索引投影和 source revision。
- 采用: 每条决策 Markdown 直接位于 `<domain-id>/<semantic-slug>.md`；路径第一段是唯一领域归属和稳定身份的一部分，不保留独立主题或路径分组分类。
- 采用: Markdown frontmatter 和索引 state 不保存 `domain`；索引 `metadata.domains` 完整投影目录表，`keys.domain` 从 `state.path` 第一段派生并用 metadata 校验。
- 采用: 一条判断只选择拥有被改变契约的主要领域；可独立演进的跨领域判断拆成多条决策，其他影响保留在正文而不扩展多领域字段。
- 采用: `list` 至多接受一个领域筛选，并在查询输出中提供相关领域定义；`domains` 独立读取完整目录表，`show` 和 `trace` 提供所涉及领域的 ID 与描述。
- 采用: 未定义、嵌套、空的领域目录和领域目录中的非 Markdown 文件均无效；已定义但暂时没有记录的领域不创建空目录，仍保留在目录表和索引 metadata 中。
- 采用: 领域归类纠正或领域结构演进需要协调移动 Markdown、更新直接关系和仓库引用，并完整重建索引；历史归档正文保留当时判断，不为清除旧词汇改写证据。
