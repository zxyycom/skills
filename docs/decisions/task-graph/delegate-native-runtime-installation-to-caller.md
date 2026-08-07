---
title: 将 task-graph 原生运行时安装委托给调用方
status: active
alignment: aligned
createdAt: 2026-08-07T02:31:24Z
purpose: 保留经过探针验证的原生锁，同时删除 task-graph 对包管理器进程和安装生命周期的监督责任。
background: 固定 npm 包已经携带多平台 prebuild，CLI 内建超时、输出清理、marker、并发发布和安装回收没有改善任务图能力。
decision: runtime info 只返回状态、诊断和固定安装 argv，由取得授权的调用方执行安装，再由同一命令验证精确直接版本、API 和真实探针。
relations:
  - type: 修订
    target: task-graph/install-native-runtime-in-user-tool-home.md
---

## 目的

- 继续让 task-graph mutation 使用经过当前 Node、平台和架构真实探针的原生文件锁。
- 让联网、包管理器执行、超时、输出和进程清理由实际拥有 shell 权限与执行环境的调用方负责。
- 保持 Git、skill zip 和生成 CLI 不包含 `.node`，同时删除不能提升任务编排能力的安装监督协议。

## 背景

- `fs-native-extensions@1.5.0` 的正式 npm 包已经携带所需 prebuild；task-graph 不需要建立平台制品流水线。
- CLI 内建 npm runner 需要处理进程树终止、输出凭据清理、超时、并发临时目录、marker、发布与回收，维护面大于 runtime 定位和兼容性验证本身。
- 调用方必须先取得联网和用户 tool home 写入授权，也已经拥有适合当前平台的 shell 执行与诊断能力。
- Mutation 仍必须失败关闭，不能从祖先 `node_modules` 静默加载或在缺失时自动安装。

## 决策

- 采用: 默认 tool home 保持为 `~/.tools/task-graph`，非空 `TASK_GRAPH_TOOL_HOME` 完整覆盖；runtime ID 固定为 `fs-native-extensions-1.5.0`。
- 采用: 唯一 runtime 命令 `runtime info` 返回 `missing`、`compatible` 或 `incompatible`、精确目录、兼容布尔值和诊断；缺失时另外返回固定 `npm install --prefix ... --save-exact fs-native-extensions@1.5.0` argv。
- 采用: 取得授权的调用方原样执行返回的 argv，再重新调用 `runtime info`；task-graph CLI 不运行 npm、不联网、不保存 runtime marker，也不管理安装临时目录或并发发布。
- 采用: 已有目录只核对直接包精确版本、`tryLock`、`unlock` 和系统临时目录中的真实探针；mutation 复用同一路径，并以 `RUNTIME_MISSING` 或 `RUNTIME_INCOMPATIBLE` 失败关闭。
- 不采用: skill 内 runtime manifest 与 npm lockfile、CLI 安装或检查子命令、完整传递闭包 realpath 验证、安装 GC，以及 native 加载失败后的第二套锁实现。
