---
title: 按 task index 身份定位工作区外短锁
status: active
alignment: aligned
createdAt: 2026-08-11T03:21:59Z
purpose: 让同一主机上的索引 mutation 共享稳定短锁，同时不在目标工作区创建锁文件或忽略规则。
background: Advisory lock 只需遵守协议的写入者打开同一稳定文件，锁位置无需与索引相邻。
decision: 由规范索引绝对路径的 hash 在系统临时目录定位稳定锁，锁只覆盖本地短事务并不管理工作区路径。
relations:
  - type: 拆分
    target: task-graph/keep-task-graph-locks-outside-workspace.md
---

## 目的

- 让同一主机上遵守 task-graph 协议的写入者对同一索引使用同一个短事务锁。
- 让目标仓库只承载权威 task index，不承担旁路锁文件、锁状态或 `.gitignore` 管理。

## 背景

- 原生 advisory lock 的互斥身份取决于所有写入者打开同一稳定普通文件，而不要求该文件位于索引旁边。
- 系统临时目录可以在重启后清理遗留文件；锁持有状态由操作系统句柄维护，不由文件内容或 stale 标记维护。
- 接管用户仓库的忽略规则或逐级检查符号链接会扩大 task-graph 的路径责任，却不能覆盖不遵守协议的写入者。

## 决策

- 采用: 以规范 task index 绝对路径计算 SHA-256；Windows 路径先转为小写，再在系统临时目录 `task-graph-locks/<hash>.lock` 定位稳定锁文件。
- 采用: 每次 mutation 在取锁前幂等创建锁根目录，打开稳定空文件并有界轮询原生 `tryLock`；锁只覆盖一次索引事务，句柄关闭或进程退出时由操作系统释放。
- 采用: 工具不主动删除锁文件，不在目标工作区创建旁路锁，也不读取、创建或修改项目 `.gitignore`。
- 采用: 支持边界限于同一主机、本地文件系统、稳定索引路径和遵守 CLI 协议的写入者；不承诺网络文件系统或恶意本机路径竞争。
- 不采用: 工作区相邻锁、锁文件 owner 或 heartbeat、stale 清理协议，以及逐级符号链接拒绝。
