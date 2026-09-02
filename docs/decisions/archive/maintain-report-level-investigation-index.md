---
title: 以报告级身份维护可重建调查索引
status: archived
alignment: aligned
createdAt: 2026-08-28T10:12:51Z
purpose: 让每份调查报告以稳定 Investigation ID 独立发现、查询和建立演进关系，并使索引继续只作为可重建投影。
background: 主题路径、状态和追加报告容器把分类与身份耦合，无法表达跨报告认识演进；报告级 Markdown 已成为唯一事实源。
decision: 按 Investigation ID 为每份单报告投影索引 state、tags、关系、资源引用和来源版本；索引可删除重建且不保存可由 ID 推导的路径。
tags:
  - investigation-report
relations:
  - type: 修订
    target: maintain-topic-level-investigation-index.md
---

## 目的
- 让每份形成时调查认识拥有稳定、可直接查询的 Investigation ID，而不再依赖 topic 路径、category 目录或主题容器。
- 让查询索引支持报告级 tags、形成时间、问题、直接关系和资源引用，同时保持 Markdown 为唯一事实源。
- 让索引损坏或缺失后可以从完整报告集合确定性重建。

## 背景
- 主题级 entry 同时承接路径身份、单一分类、状态、最新报告时间和追加序列，不能表示一份报告对跨主题前序的补充、复查、修正、推翻、归并或拆分。
- 新模型中每份报告根目录直属，basename 的 Investigation ID 同时决定位置；tags 与关系直接由该报告 frontmatter 声明。
- 派生索引仍需要为日常 list、show 和 trace 提供低成本读取，但不能反向补造报告语义或保存第二份路径事实。

## 决策
- 采用: 每份根目录直属报告以唯一 Investigation ID 作为索引 entry；ID 是合法 Markdown basename，也是唯一相对路径，不在 state 或索引中重复保存 sourcePath。
- 采用: 报告 state 投影 title、formedAt、question、tags、完整直接 relations 和 resource IDs；不保留 topic、category、状态、最新报告时间、报告数量或按 H3 追加顺序。
- 采用: 索引以报告 tags、形成时间、关系类型和文本建立查询 keys，重复 tag 条件使用 AND；show 与 trace 通过持久索引定位报告和图关系。
- 采用: metadata 保持为空对象，索引 source revision 从完整报告 Markdown 集合及其可投影事实确定性派生；成员、标题、时间、问题、tags、relations 或资源引用变化必须使相应投影和来源版本变化。
- 采用: sync-index 在完整集合有效后重建唯一 investigation-index.json，check 验证完整集合、关系图与索引新鲜度；不保留 topic 兼容 reader、category 查询或旧索引双写。
