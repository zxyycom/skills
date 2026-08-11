---
title: 将 task-graph 短事务锁保留在工作区外
status: archived
alignment: aligned
createdAt: 2026-08-07T02:31:25Z
purpose: 保留权威 JSON 与原生短锁，同时让目标仓库只承载任务索引，不承担锁文件和忽略规则管理。
background: 稳定锁身份可以由索引绝对路径在系统临时目录确定，工作区旁路锁、符号链接门禁和提交回读增加维护面却不改变领域结果。
decision: 以索引路径 hash 定位系统临时锁，原子写 resolve 即成功、reject 统一未知，并停止管理工作区 gitignore 与路径别名防护。
relations:
  - type: 修订
    target: task-graph/use-native-locks-for-json-transactions.md
---

## 目的

- 保留 JSON 索引的可读性、Git diff、revision CAS、完整候选校验和跨进程短事务互斥。
- 让目标工作区只出现权威索引，不由 task-graph 创建旁路锁或接管项目 `.gitignore`。
- 以保守且单一的提交错误语义代替对 atomic reject 结果的精细猜测和额外读回。

## 背景

- 原生 advisory lock 只需要同一主机上的所有遵守协议写入者打开同一个稳定普通文件；该文件不必与索引相邻。
- 系统临时目录在重启后清理不会遗留存活锁持有者，下次 mutation 可以按确定性路径重新创建空锁文件。
- 修改用户仓库的 `.gitignore` 会越过任务索引责任边界，且用户可能有自己的忽略或跟踪策略。
- `write-file-atomic` resolve 已经表达库调用成功；reject 后再次读取只能观察某个时点，不能证明调用方可以安全自动重放。

## 决策

- 采用: 用规范索引绝对路径计算 SHA-256；Windows 先转小写，再把锁定位到系统临时目录 `task-graph-locks/<hash>.lock`。
- 采用: mutation 取锁前幂等创建锁根目录，打开稳定空文件并有界轮询 `tryLock`；工具从不删除锁文件，句柄关闭或进程退出负责释放操作系统锁。
- 采用: 获锁后继续执行最新索引读取、schema 与完整图校验、revision 或 lease 前置校验、领域变换和规范序列化，再调用一次 `write-file-atomic`。
- 采用: atomic 调用 resolve 后立即成功，不提交回读；调用 reject 后统一返回 `WRITE_OUTCOME_UNKNOWN`，要求调用方重读索引和目标实体后决定下一步。
- 采用: task-graph 不读取、创建或修改目标项目 `.gitignore`，也不逐级拒绝符号链接；支持范围只包括同一主机、本地文件系统、稳定索引路径和遵守 CLI 的写入者。
- 不采用: 工作区相邻锁、Git 忽略规则管理、old/candidate/other 读回分类、JSON/SQLite 双后端，以及网络文件系统或恶意本机路径竞争保证。
