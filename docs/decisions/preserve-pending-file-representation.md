---
title: 保持待提交文件表示的端到端一致性
id: 261005-preserve-pending-file-representation
status: active
alignment: aligned
createdAt: 2026-10-05T10:08:30Z
purpose: 让共享快照完整保存文件表示，暂存可执行资源时既不误判冲突也不丢失执行位。
background: 调查暂存会重建包含可执行资源的完整范围，而纯路径与字节契约不能保真表达该目标。
decision: 公共快照增加文件表示；共享层核对、写入和读回都保真，领域层不处理原始 Git 模式。
tags:
  - artifact-integrity
  - responsibility-boundaries
  - version-control
relations:
  - type: 修订
    target: manage-pending-snapshot-writes
    summary: 保留共享写入责任并增加文件表示保真义务
---

## 目的

- 让共享版本快照和范围替换完整表达内容与文件表示，保留可执行资源的执行位。
- 保留期望保护、范围外状态和失败恢复边界，让领域消费者使用完整快照语义。

## 背景

- [共享版本管理层](../../tools/shared/version-control.md)已承接仓库发现、revision、pending、工作区读取和受期望保护的范围替换。原契约只携带路径与字节，并将目标固定为普通文件。
- Investigation Report 的 all/domain 暂存重建整个调查范围，其中既有可执行附件也可能属于未选报告。纯路径与字节不能表达既有文件表示或显式执行位变化，因此普通文件限制与资源保真义务不匹配。
- 延续共享 owner、锁定写入、读回与恢复方向，扩充公共文件表示，可以满足资源保真且保持底层依赖边界。

## 决策

- 采用: 共享层继续拥有仓库发现、revision、pending、工作区读取和完整范围替换。范围内缺失目标成员表示删除，范围外内容与表示保持不变；共享操作不可用时，消费者以稳定失败停止。当前实现使用 Git，其命令、index、模式、对象 ID、锁、第三方对象和错误解析留在共享层内部。
- 采用: 公共快照必须携带 `path`、`data` 和 `kind`；`kind` 区分 `regular`、`executable`、`symlink`，只表达文件表示。保留快照时整体传递这三个字段，生成普通文件时显式声明 `regular`。
- 采用: 取得写入边界后核对 `expectedRevision`，并按可选 `expectedFiles` 核对完整成员、字节和表示；真实的表示漂移属于冲突。按目标 `kind` 构造、复用和读回，只有完整目标验证成功才发布；失败保留原范围，无法确认恢复时明确报告未知边界。
- 采用: 共享层读取常规非符号链接工作区文件的字节与有效执行位，在 Git adapter 内遵循 `core.fileMode`。配置或表示无法可信读取时停止，由共享层承担判定责任。
- 采用: [Investigation Report](../../skills/investigation-report/SKILL.md) 的所选常规来源使用有效工作区表示，未选 pending 快照完整保留；执行位漂移参与写前核对，仅执行位变化参与结果报告。所选报告与附件继续要求非符号链接来源。
