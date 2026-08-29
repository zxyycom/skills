---
title: 按稳定 Decision ID 构造待提交快照
status: active
alignment: aligned
createdAt: 2026-08-15T03:14:04Z
purpose: 让调用者从并行磁盘决策变化中按稳定身份选择可独立提交且索引一致的待提交决策集合。
background: 当前路径会因分类和归档移动而变化；以路径作为选择单位会把位置变化误判为身份变化，并妨碍选择性暂存保持完整一致的索引。
decision: stage 以 Decision ID 显式选择 filesystem 变化，以 revision 为基线构造完整目标集合并原子替换 pending 决策范围。
tags:
  - decision-records
  - version-control
relations:
  - type: 修订
    target: stage-selected-decisions.md
---

## 目的

- 让并行决策变化可以按稳定身份被独立选择进入下一版本，而不混入未选择的磁盘变化。
- 保持 pending 中的决策 Markdown、完整索引和来源集合彼此一致，同时不改变 filesystem 生命周期集合。
- 让同一 Decision ID 的位置移动保持一次选择语义，避免把归档或分类移动误当成记录删除与新增。

## 背景

- 完整派生索引覆盖整个决策集合，普通路径暂存无法为单个并行变化构造合法索引，也不应把其他 filesystem 变化带入 pending。
- Decision ID 与 `sourcePath` 分离后，当前位置不再是身份；同一 ID 可以在 current 与 archive 位置之间移动，而 basename 改变才是需要同时表达旧、新身份的变更。
- 生命周期命令维护 filesystem，版本控制的 pending 快照维护下一版本；两者必须使用同一目标来源构造索引，但不能相互承担写入责任。

## 决策

- 采用: `stage` 接受显式列出的 Decision ID，并以当前 revision 的完整决策来源为基线，只叠加所选 ID 在 filesystem 中的状态。未选择的 filesystem 决策变化不进入目标 pending 集合，既有 pending 的决策范围不作为目标输入。
- 采用: 对同一 Decision ID，revision 与 filesystem 的 `sourcePath` 不同表示一次移动；调用者只选择该 ID。basename 改变是身份迁移，必须同时显式选择旧 ID 与新 ID，命令不从关系、差异或命令历史推断选择集合。
- 采用: 目标集合从相同的 Markdown 来源重建并严格验证完整索引后，原子替换 pending 中的完整决策范围。首次没有 revision 基线时才由 filesystem 引导完整集合；范围外 pending 内容和 filesystem 保持不变。
- 采用: 非法或重复 ID、缺失选择、目标集合不合法、revision 或受控 pending 漂移、版本管理不可用以及无法恢复的写入失败都停止且不接受部分 pending 结果。stage 不修改 filesystem 决策 Markdown。
- 采用: lifecycle 命令继续直接维护 filesystem 的记录与索引，不增加 `--stage` 分支；stage 保持为版本快照入口，不以 pending 状态决定决策的生命周期、关系或对齐。
- 不采用: 以当前路径作为 stage 的选择身份，或通过自动扩展选择集推断移动、改名和并行变更。这样会在分类与归档演进时错误包含或遗漏独立决策变化。
