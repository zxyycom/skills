---
title: "约束收窄后采用原生锁与原子写库"
formedAt: "2026-08-07T01:45:30+08:00"
question: "约束收窄后，原生锁和原子写库能否分别完整承接 task-graph 的窄责任？"
tags:
  - "task-graph"
relations:
  - type: "复查"
    target: "reject-lock-and-atomic-write-library-dependencies.md"
---

## 形成时背景

上一份报告的“不采用”建立在 task-graph 必须自行保存 owner token、PID、heartbeat、stale 候选、generation、reclaimer 和 quarantine，并对陈旧锁执行保守恢复这一组硬约束上。在这些约束下，候选库确实没有接走最复杂的协议责任。

后续设计改变了前提：task-graph 的短事务只承诺同一主机的本地文件系统和遵守 CLI 协议的写入者；接受原生 advisory lock 在句柄关闭或进程退出时释放，存活但卡死的持有者只得到 5 秒有界超时，不再自动抢锁。用户也接受在首次 mutation 前显式联网，把锁定 native addon 安装到 skill 自己拥有的用户工具目录；`.node` 仍不进入 Git 或 skill zip。原子提交只要求成熟库承接同目录临时写入、文件 `fsync` 和单次 rename，task-graph 继续拥有路径门禁、完整候选校验、回读及 old/candidate/unknown 分类。

## 调查目的

本轮复核原结论的适用边界，并确认在新约束下：

1. `fs-native-extensions@1.5.0` 是否足以承接跨进程短锁，且能够保持安装、加载和平台兼容性失败关闭。
2. `write-file-atomic@8.0.0` 是否实际缩小提交实现，同时不隐藏 task-graph 必须保留的单次提交和结果分类。
3. 哪些边界仍不能从库名称、N-API、普通测试或成功安装外推。

## 调查范围与依据

依赖判断继续以 [`fs-native-extensions@1.5.0`](https://github.com/holepunchto/fs-native-extensions/tree/v1.5.0) 和 [`write-file-atomic@8.0.0`](https://github.com/npm/write-file-atomic/tree/v8.0.0) 的正式源码、包元数据与许可证为依据。实施事实来自 [`simplify-task-graph-json-transactions` design](../../changes/archive/simplify-task-graph-json-transactions/design.md)、当时分发的精确 runtime manifest 与 npm lockfile、[`runtime.ts`](../../tools/task-graph/src/runtime.ts)、[`store.ts`](../../tools/task-graph/src/store.ts) 及对应 runtime、store、CLI 和生成产物测试。

当前验证覆盖 Windows 上的真实 addon 探针、独立描述符互斥、进程级 claim 竞争、持锁子进程退出、安装并发收敛、安装后离线 mutation、atomic writer 故障分类和分发树无 `.node`。POSIX 进程组终止与符号链接相关 case 在 Windows 上保守跳过，交给受支持的 POSIX CI 运行；没有验证网络文件系统、恶意本机路径竞争或断电后的目录元数据持久性。

## 调查结果与边界

**当前结论是采用 `fs-native-extensions@1.5.0` 和 `write-file-atomic@8.0.0`，但只委托各自能够完整拥有的窄责任。** 旧报告仍准确描述旧 owner/stale recovery 协议；它不适用于已经明确删除该协议、接受显式 native runtime 的当前约束。

`fs-native-extensions` 只承接稳定旁路文件上的 advisory `tryLock(fd)` 与 `unlock(fd)`。Task-graph 仍负责以 `open("a+")` 打开普通文件、单调时钟轮询、5 秒门禁、finally 中 unlock/close 和错误分类。锁文件长期保留且为空；不保存 owner metadata，也没有基于年龄、PID 或 generation 的恢复动作。进程退出自动释放是操作系统句柄行为，不代表网络文件系统或不遵守协议的进程受到互斥。

Native addon 不随 skill 打包。Skill 分发精确 manifest 与 npm lockfile，使用 `npm ci --ignore-scripts --omit=dev --no-audit --no-fund` 安装到不可变 runtime ID 目录。加载前逐项核对 lockfile 中所有非 optional 包的目标 realpath 和精确版本，再以目标 runtime 的 `createRequire()` 解析入口；任何祖先 `node_modules` fallback、API 不匹配或真实探针失败都报告不兼容。成功探针只证明当前 Node、平台和架构组合可用，不外推其他平台。

`write-file-atomic` 承接同目录临时文件、文件 `fsync` 与 rename，并内联到生成 ESM。Task-graph 对每个候选只调用一次，调用抛错后回读完整文本：仍为旧原文时报告 `WRITE_FAILED`，已经是候选原文时按成功，其他内容或回读失败时报告 `WRITE_OUTCOME_UNKNOWN`。库的同进程队列不替代跨进程 native lock；已有目标的 realpath 解析也不替代 task-graph 的符号链接门禁。

采用 `write-file-atomic@8.0.0` 同时固定分发 CLI 的 Node engine 为 `^22.22.2 || ^24.15.0 || >=26.0.0`。Bun 仍只运行仓库构建和测试。`runtime info`、help、只读查询和模块导入不加载 addon；所有 mutation 在读取 apply 文件、stdin 或触碰工作区前检查 engine 和 runtime。只有显式 `runtime install` 可以联网或写用户 tool home。

两项采用都不提供目录 `fsync`。因此普通成功表示原子替换和随后回读成立，不声称突然断电后目录项已经稳定落盘。路径检查与实际打开之间仍存在非恶意本机路径威胁模型下接受的竞争窗口；需要 no-follow 或恶意并发防护时必须另立平台设计。

## 后续复核条件

出现以下任一情况时追加调查，而不是扩大当前结论：

1. 需要支持新 Node 主版本、未受测平台、网络文件系统或按平台预构建制品。
2. 锁定依赖、传递闭包、许可证、安装脚本或 native 加载方式发生变化。
3. 需要断电后的目录级持久性、no-follow 路径安全或不遵守 CLI 的本机写入者互斥。
4. 真实故障表明 5 秒 advisory lock、单次 atomic write 或当前 old/candidate/unknown 分类不足以恢复。
