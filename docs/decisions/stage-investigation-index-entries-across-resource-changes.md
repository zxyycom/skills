---
title: 让调查索引条目暂存不受资源变化阻塞
status: active
alignment: unaligned
createdAt: 2026-08-17T08:03:17Z
purpose: 让按主题选择的调查索引条目可以独立进入 pending，不因集合级资源状态被迫整体暂存。
background: stage-index 只组合派生索引条目，却因调查资源被放入集合级 metadata 而拒绝任何伴随资源变化的条目级操作。
decision: stage-index 保持只暂存选中索引项；调查领域不再用资源变化触发集合门禁，领域文件仍由调用方显式选择。
tags:
  - investigation-report
relations:
  - type: 修订
    target: stage-selected-investigation-index-entries.md
---

## 目的

- 让并行维护多个调查主题时，只把选中主题对应的派生索引变化写入 pending。
- 保持索引条目组合与主题 Markdown、随附资源的 Git 选择责任分离。
- 消除无关资源变化造成的调查领域集合门禁，同时保留真实索引 pending 冲突和非法主题选择诊断。

## 背景

- `stage-index` 当前只接收规范 topic ID 并委托公共 selected-entry staging，不读取或暂存主题 Markdown 与资源文件。
- 公共运行时正确要求集合级 metadata 稳定；阻塞来自调查领域把资源成员和 SHA-256 放入该集合边界，而不是公共 staging 算法。
- [索引来源决策](exclude-investigation-resources-from-index-revision.md)让资源退出调查 metadata 后，资源变化不再代表主题索引集合契约变化；报告链接变化仍由对应 topic entry 表达。

## 决策

- 采用: `stage-index <topic-id...>` 继续校验规范且不重复的 topic ID，并只委托公共 selected-entry staging；领域入口不自行构造基线、metadata、source revision 或领域文件计划。
- 采用: 成功只表示选中主题的派生索引结果进入 pending。命令不读取、校验、写入或暂存主题 Markdown 与资源文件，调用方继续显式选择领域文件。
- 采用: 调查领域不再因为资源新增、删除、移动、改名或字节变化返回 `collection-changed`。报告资源链接变化在同步后随对应 topic entry 选择，无关主题与资源变化留在工作区。
- 采用: 同一调查索引已有 pending 时继续拒绝覆盖、累加或清除；目标索引之外的 pending 保持不变。Topic 重命名仍同时选择旧、新 ID，其他参数、版本控制失败和结果边界保持原契约。
- 采用: `stage-index` 成功不证明工作区索引新鲜、报告合法或资源有效；调用方在暂存前继续完成 `sync-index` 与默认全量 check。
