---
title: 显式剔除完整且无引用的调查报告
status: active
alignment: aligned
createdAt: 2026-08-29T15:42:49Z
purpose: 让确需删除的调查报告通过独立、可预演且可恢复的机械动作退出集合。
background: 长期保留不等于永远禁止删除；手工删除会把关系、资源 owner、派生索引和 Git 记录边界留给调用方拼接。
decision: 删除只通过 discard 事务完成，并在写入前验证完整图、资源归属、版本记录与恢复边界。
tags:
  - investigation-report
  - version-control
relations:
  - type: 拆分
    target: model-investigation-evolution-and-explicit-removal.md
---

## 目的

- 让明确不应继续保留的报告可以安全退出集合。
- 让关系引用、拆分闭包、资源 owner、派生索引和 Git 记录在删除前得到同一机械事务保护。

## 背景

- 报告可能因错误建立、敏感信息、重复内容或明确维护要求而需要删除。
- 裸删 Markdown 会留下悬空关系、无 owner 资源或陈旧索引；已进入 Git 历史的报告和资源具有更明确的记录删除边界。

## 决策

- 采用: 删除只由 `discard <investigation-id>` 表达；它在写入前预演移除目标后的完整关系图和索引，目标仍被关系引用、删除会破坏拆分闭包或索引不是当前投影时拒绝。
- 采用: 目标拥有资源时由调用方显式确认一起删除；资源仍被其他报告引用时拒绝，不自动转移 owner。Ignored、不安全、非普通或发生漂移的 owner 成员不进入递归删除。
- 采用: 目标报告或将删资源已进入 Git `HEAD` 时，首次调用零写入暂停并要求机械确认参数；非 Git 或 unborn `HEAD` 不增加该门禁，Git 检查异常则失败关闭。
- 采用: `discard`、关系维护与完整索引同步共用集合写锁，并以同文件系统 tombstone 和索引原子发布保护删除；索引发布是领域提交点。
- 不采用: 手工删除报告或资源，或用报告关系表达删除。
