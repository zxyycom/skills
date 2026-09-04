---
title: 完成 Change Plan 后删除目录
id: 260904-complete-change-plans-by-deletion
status: archived
alignment: unaligned
createdAt: 2026-09-04T20:24:06Z
purpose: 让 Change Plan 只承担实施期规划，并在完成后由 Git 保留可恢复历史。
background: archive 只保留不再受检查的计划快照，却持续扩大名称空间、查询和维护责任。
decision: 以完整 Plan、任务与 Git tree 门禁的 complete-and-delete 替代 archive 和 archived raw reader。
tags:
  - change-plan
relations:
  - type: 修订
    target: validate-only-active-change-plans
---

## 目的

- 让 proposal、design 与 tasks 只在需要规划、实施、验证和 owner 交接时占用 Change 名称空间。
- 完成后以 Git 作为可恢复历史，而不是继续维护不再适用当前契约的 archived artifact 快照。

## 背景

- 先前方向把 archive 视为 active Plan 最终门禁后的只读历史，并使 list、show、目录 status 与 raw reader 长期承担该历史形态。
- 这些计划目录不拥有稳定事实、长期理由或独立调查结论；应在完成前交接给项目 owner、Decision 或 Investigation，而非在 Change Plan 内重复保存。
- 普通 Git 已保存可恢复的工作树历史。只在工作树与当前 HEAD 精确一致时删除，能够同时避免误删未记录内容并消除 archived 运行时表面。

## 决策

- 采用: Change 生命周期收敛为 `draft -> plan -> complete -> directory absent`；完成不是 metadata 或目录 status，公开 CLI 不再提供 archive、archived selector、history reader 或兼容 alias。
- 采用: `complete` 先要求有效且任务全完成的 Plan，再以当前 Git HEAD 的 regular-file tree、同设备 tombstone 和移动前重验作为机械删除门禁；preflight 零写入，移动后清理不能证明完成时报告精确 tombstone 与 recovery revision。
- 采用: 完成前由执行者进行语义审阅、交接稳定 owner 并取得删除授权；工具不代替授权，也不 stage、commit、reset 或自动 Git restore。完成后需要查看内容时使用普通 Git。
- 采用: 旧 archive 只通过一次性、内部且可恢复的迁移退出工作树；迁移实现和任何 legacy surface 在迁移后删除，不成为长期 Change Plan API。
