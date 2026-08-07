---
title: 使用原生文件锁简化 JSON 事务
status: active
alignment: aligned
createdAt: 2026-08-06T16:23:21Z
purpose: 让 task-graph 保留可追踪 JSON，同时把跨进程互斥和原子替换交给成熟系统与库边界。
background: 自研锁恢复需要 owner、heartbeat、进程探测和 generation 防护，维护面远超短事务本身。
decision: 使用稳定旁路文件上的原生排他锁和成熟原子写库，并保留 revision、执行租约与未知结果核验。
relations: []
---

## 目的

- 保留权威 JSON 索引的可读性、Git diff 和现有任务领域语义，同时显著缩小短事务存储层的代码、测试与恢复状态。
- 让跨进程互斥由操作系统文件句柄生命周期保证，让临时写入、文件同步和原子替换由成熟库承接。
- 继续区分短事务锁、revision 冲突检测和长时间 task execution lease，不让底层锁改变任务调度语义。

## 背景

- 当前 task-graph 为本地 JSON 自行维护锁目录、owner metadata、heartbeat、进程存活探测、generation、reclaimer、quarantine 和 ABA 防护。
- 这些机制主要服务陈旧锁回收；接受同主机本地文件系统、进程退出时由操作系统释放锁，以及存活持有者卡死时失败关闭后，不再需要以时间和 owner metadata 判断抢锁。
- 权威 JSON、revision CAS、完整图校验、事务 claim 和写入结果核验仍有独立价值，不能因为采用原生锁而删除。
- Task execution lease 会跨越实际工作时间；短事务锁只应覆盖一次索引读取、变换、校验和提交。

## 决策

- 采用: task-graph mutation 在一个长期存在、不会随索引原子替换而改变身份的旁路文件上获取原生排他锁；只读查询不持锁，实际任务执行期间也不持锁。
- 采用: 获锁后重新读取最新索引，依次完成 schema 与完整图校验、revision 或 claim 前置校验、领域变换、候选校验和规范序列化，再通过成熟原子写库执行一次提交。
- 采用: 原子写失败后只进行结果回读核验；完整候选已经存在时按成功处理，完整旧版本仍存在时报告写入失败，其他状态报告未知结果并要求调用方重新查询。
- 采用: 进程退出或关闭文件句柄后由操作系统释放锁；存活但卡死的持有者只产生有界锁超时，不通过 stale 时间、PID、heartbeat 或 generation 自动抢锁。
- 采用: 索引初始化为旁路锁和原子写临时文件维护目标仓库内的 Git 忽略规则；锁文件及其内容不是权威事实，也不进入 Git。
- 采用: 第一版只承诺同一主机的本地文件系统和所有写入者遵守 task-graph CLI 协议，不承诺网络文件系统、恶意本地路径竞争或突然断电后的目录级持久性。
- 不采用: 自研陈旧锁恢复、双锁 fallback、通用 lock provider、JSON/SQLite 双后端或在任务执行期间保持文件锁。
