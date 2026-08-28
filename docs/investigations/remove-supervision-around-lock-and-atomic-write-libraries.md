---
title: "保留成熟库并删除外围监督协议"
formedAt: "2026-08-07T10:28:43+08:00"
question: "删除外围监督协议后，已选锁与原子写库应继续承接哪些责任？"
tags:
  - "task-graph"
relations:
  - type: "修正"
    target: "adopt-native-lock-and-atomic-write-libraries.md"
---

## 形成时背景

实现复盘表明，实际占用最多代码和测试的并不是 task graph 的任务、关系或 lease 语义，而是 native runtime 的 npm 子进程监督、安装 marker、精确传递闭包验证，以及 atomic reject 后的回读分类。这些外围协议没有改善用户可感知的任务编排能力，也没有改变两个库已经承担的核心责任。

[`reduce-task-graph-infrastructure` design](../../changes/archive/reduce-task-graph-infrastructure/design.md)进一步收窄边界：调用方可以接受显式 npm argv；锁文件可以离开工作区；atomic reject 可以保守地统一视为结果未知；平台兼容性继续由真实 addon 探针确认。

## 调查目的

本轮确认简化是否需要撤回库选型，以及删除外围协议后两个依赖仍分别承接什么责任。

## 调查范围与依据

本轮不重新比较 npm 生态候选，也不改变两个固定依赖版本。判断依据是 [`reduce-task-graph-infrastructure` design](../../changes/archive/reduce-task-graph-infrastructure/design.md)、[`runtime.ts`](../../tools/task-graph/src/runtime.ts)、[`store.ts`](../../tools/task-graph/src/store.ts)，以及对应 runtime、store、CLI、跨进程和生成产物测试。验证环境是当前 Windows 与受支持 Node；网络文件系统、断电目录持久性、恶意路径替换和不遵守 CLI 的写入者不在范围内。

## 调查结果与边界

**结论仍是采用 `fs-native-extensions@1.5.0` 与 `write-file-atomic@8.0.0`，但删除 task-graph 对安装进程和提交结果精细分类的监督。** 这不是改回自研锁或原子写；相反，它让库的责任与 task-graph 的领域责任更直接。

`fs-native-extensions` 继续承接 `tryLock(fd)` 与 `unlock(fd)`。Task-graph 的 `runtime info` 只定位固定目录、核对直接包精确版本、加载 API 并执行真实探针；缺失时返回固定 npm argv，由取得授权的调用方执行。CLI 不运行 npm，不保存 runtime marker，不验证完整传递闭包，也不管理安装临时目录。稳定锁迁到系统临时目录，以规范索引绝对路径的 SHA-256 定位；工作区不再出现 `.lock`，工具也不接管项目 `.gitignore`。

`write-file-atomic` 继续承接同目录临时写、文件 `fsync` 和 rename。调用 resolve 后 task-graph 立即接受成功；调用 reject 后统一返回 `WRITE_OUTCOME_UNKNOWN`，只要求调用方重读索引和目标实体。工具不再通过提交后回读区分 old、candidate 和其他结果，也不因此自动重试。

当前实现已证明当前 Windows/Node 组合上的真实探针、独立描述符互斥、持锁进程退出释放、5 秒有界等待、调用方准备后的离线 mutation，以及 atomic resolve/reject 的新边界。

## 后续复核条件

只有直接包版本或 API、受支持 Node/平台、锁文件系统边界、atomic writer，或上述非支持范围发生变化时，才需要重新调查库选型。调用方 shell 的 npm 超时、输出处理和进程清理由当前执行环境负责，不再进入 task-graph 的库适配评估。
