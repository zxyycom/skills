---
title: 按报告 ID 独立暂存调查索引条目
status: active
alignment: aligned
createdAt: 2026-08-28T10:12:56Z
purpose: 让按 Investigation ID 选择的派生索引条目可以独立进入 pending，不因资源文件变化或其他报告阻塞。
background: stage-index 只组合派生索引项，不拥有报告 Markdown 或资源文件的暂存责任；新索引以单报告 ID 作为 entry 单位。
decision: stage-index 只接收并暂存选中 Investigation ID 的索引项；资源变化不触发集合门禁，报告和资源仍由调用方显式选择。
tags:
  - index-runtime
  - investigation-report
  - version-control
relations:
  - type: 修订
    target: stage-investigation-index-entries-across-resource-changes.md
---

## 目的
- 让并行维护多个调查报告时，只把选中报告对应的派生索引变化写入 pending。
- 保持索引条目组合与报告 Markdown、随附资源的 Git 选择责任分离。
- 消除无关资源变化造成的集合门禁，同时保留真实索引 pending 冲突和非法报告选择诊断。

## 背景
- stage-index 的职责是按稳定 entry ID 委托通用 selected-entry staging，而不是读取或暂存调查领域源文件。
- 资源文件已经退出索引 metadata 和 source revision，资源的新增、移动、改名或字节变化不再代表报告索引集合契约变化。
- 报告资源链接本身仍是报告 Markdown 的事实，sync-index 后会反映在对应 report entry 中。

## 决策
- 采用: `stage-index <investigation-id...>` 校验规范且不重复的 Investigation ID，并只委托公共 selected-entry staging；领域入口不自行构造基线、metadata、source revision 或领域文件计划。
- 采用: 成功只表示选中报告的派生索引结果进入 pending。命令不读取、校验、写入或暂存报告 Markdown 与资源文件，调用方继续显式选择领域文件。
- 采用: 调查领域不因资源新增、删除、移动、改名或字节变化返回 collection-changed。报告资源链接变化在同步后随对应 report entry 选择，无关报告与资源变化留在工作区。
- 采用: 同一调查索引已有 pending 时继续拒绝覆盖、累加或清除；目标索引之外的 pending 保持不变。报告 ID 改名仍同时选择旧、新 ID。
- 采用: stage-index 成功不证明工作区索引新鲜、报告合法或资源有效；调用方在暂存前继续完成 sync-index 与默认全量 check。
