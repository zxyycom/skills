---
title: "轻量调用日志初始化的并发 WAL 切换"
id: "261004-lightweight-judgment-wal-init-contention"
formedAt: "2026-10-04T04:45:24Z"
question: "为何并发日志 writer 在五秒 timeout 前失败，最小安全修复应落在哪个阶段？"
tags:
  - "concurrency"
  - "lightweight-judgment"
  - "sqlite"
relations: []
---

## 形成时背景

离线统计与日志 schema v2 的交付检查中，八进程追加测试出现一个 writer 在约 306ms 返回 `storage`／退出 4。预期各进程均能在原有五秒锁等待下追加独立调用。现场只有净化后的打开失败消息，具体错误代码与失败语句尚待定位；同次统计读取测试通过。

调查发生于 2026-10-04，使用 Node.js 24.18.0 及其原生 SQLite 3.53.1、私有合成数据库和模拟 fetch。受测的 v2 实现比基线增加固定 schema 校验与 v1→v2 原子迁移，两者都在 schema COMMIT 后设置 WAL。

## 调查目的

区分 schema／迁移不兼容、普通锁超时与提交后 journal 切换立即 BUSY 三种解释，确定可在五秒预算内安全恢复的初始化阶段。修复须保持其他应用／未知结构的库拒绝、数据原子性和发送前持久化约束；恢复范围限于本地初始化。

## 调查范围与依据

检查对象为 `tools/lightweight-judgment/` 的数据库初始化、schema、进程追加测试及其生成 MJS。对照基线为 Git `e6126f9c97b6ead80283b57c138d881ff9bf3811` 的 writer。下文“v2 修复前”指本轮受测实现，“基线”指该固定提交；另设仅移除提交后 WAL 设置的诊断变体。三者分别构建为临时 Node 模块，插桩只记录 SQL 阶段、错误代码和单调耗时。

### 区分性实验

先用八进程就绪屏障，每个变体运行 30 轮、共 240 个 writer：v2 修复前 0 失败、基线 1 失败、无 WAL 变体 0 失败。基线的失败定位到提交后的 `PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL`，错误为 `ERR_SQLITE_ERROR`／errcode 5，语句耗时约 0.207ms。这只证明间歇机制存在，样本不足以判断各变体的失败概率。

随后做确定性锁对照：第一连接真实完成 schema COMMIT 后暂停；第二连接 `BEGIN IMMEDIATE` 持有写锁；再放行第一连接 journal 设置，直到第一连接结束才释放第二连接。结果如下：

| 变体 | 观察 |
| --- | --- |
| v2 修复前 | journal 设置 errcode 5，约 0.122ms 立即失败；总打开耗时约 9.80ms。 |
| 基线 | 同一语句 errcode 5，约 0.085ms 立即失败；总打开耗时约 7.17ms。 |
| 仅移除 journal 设置的诊断变体 | 越过初始化；随后 INSERT 因第二连接仍持锁，约 5.02 秒等待后失败。 |

第三项将失败阶段区分为 journal 切换和普通写入，但未满足 WAL 契约或成功追加，因此只作诊断对照。v2 修复前与基线的同结果说明，新 schema 并非该机制的必要条件。

[SQLite busy handler 文档](https://sqlite.org/c3ref/busy_handler.html)说明潜在死锁可使 BUSY 绕过 handler，为 timeout 不足以覆盖该类竞争提供机制依据；本次具体失败语句仍以实验为证。[journal_mode 文档](https://www.sqlite.org/pragma.html#pragma_journal_mode)说明返回值表示实际模式，修复据此确认 WAL 已生效。

### 修复验证

通过四个独立原生回归验证生成 MJS 与真实 Node SQLite；测试 worker 在真实 COMMIT 后建立受控竞争，无生产 hook：

- 首个 journal 尝试后释放锁：等待后成功，实际模式为 `wal`，fetch 恰一次，只有一条 `succeeded`。
- 持续持锁：约 5.05 秒耗尽预算，`storage`／退出 4，attempts 与 fetch 均为 0，调用表为空。
- 注入非 BUSY errcode 10：一次失败，fetch 为 0。
- 返回模式为 `delete`：一次失败，fetch 为 0。

形成时，四项回归均通过；全部 CLI 回归在 Node 24.18 与 Bun 下各 53 项通过。五秒预算测试给予框架 10 秒上限，仍断言被测五秒预算。修复后的完整检查为 63 项通过、0 失败、3 项发布检查不适用。当前重跑入口为 `bun run test:lightweight-judgment-cli`，具体原生入口及其义务由测试与 Case 账本维护。

## 调查结果与边界

已确认 schema COMMIT 与 WAL 切换之间存在并发锁窗口：另一连接持写锁时，journal 切换立即 BUSY，原有连接 timeout 不足以保证等待；基线与 v2 修复前均可复现。原 306ms gate 失败未采集底层错误，将其归为同一语句仍是与症状一致的推断。

修复只覆盖 writer 的 WAL 设置阶段：暂置 `busy_timeout=0`，以单调 deadline 管理包含实际执行时间的单个五秒预算；仅 SQLite primary BUSY（含对应扩展码）可短等待后重试。确认返回 `wal` 后设置 `synchronous=FULL`，恢复普通 `busy_timeout=5000`。非 BUSY、非 WAL 或预算耗尽沿既有路径关闭连接并返回存储失败，尚未发送请求。schema 事务、v1 迁移及统计只读路径保持不变。

适用边界是本地 journal 准备，不包含 HTTP 重试。锁超过预算仍返回失败；其他 SQLite／平台版本、生产竞争概率和吞吐尚未验证。再次出现初始化失败时，应采集错误阶段及锁状态，区分 BEGIN／schema 事务、journal 切换和记录 INSERT。回退代码会恢复已复现的立即 BUSY 窗口，无需改写日志数据。
