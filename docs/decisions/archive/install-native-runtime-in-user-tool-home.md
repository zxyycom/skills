---
title: 在用户工具目录安装 task-graph 原生运行时
status: archived
alignment: aligned
createdAt: 2026-08-06T16:23:22Z
purpose: 让 task-graph 使用原生文件锁而不把平台二进制写入 Git 或 skill 分发包。
background: Native addon 包体不大，但 `.node` 不可审阅、会累积 Git 历史，并扩大每个 skill 制品的平台内容。
decision: 由 task-graph 显式安装锁定 native 依赖到 `~/.tools/task-graph`，并允许环境变量覆盖 tool home。
tags:
  - task-graph
relations: []
---

## 目的

- 让 task-graph 获得经过验证的 native 文件锁能力，同时保持仓库与 skill zip 不包含 `.node` 二进制。
- 让 runtime 的版本、安装位置、网络副作用、兼容性检查、缺失路径和升级行为可以被用户理解、审计和独立验证。
- 保持 task-graph 分发单元拥有自身完整交付责任，不为单个消费者提前建立通用 runtime manager 或平台制品流水线。

## 背景

- `fs-native-extensions` 的正式 npm 包已经携带多平台 prebuild，压缩体积较小，不值得由本项目重新拆分和发布平台 artifact。
- 把 `.node` 直接提交到 Git 虽然可行，但无法提供有意义的文本 diff，每次更新还会在历史中保留新的二进制对象。
- 普通查询和模块导入不需要文件锁；只有 mutation 必须加载 native addon，因此缺失 runtime 可以通过明确的能力边界表达，而不必让所有命令首次运行时静默联网。
- Skill updater 只拥有 skill 包内文件；用户工具目录中的 runtime 需要由 task-graph 自己声明安装、验证和兼容性行为。

## 决策

- 采用: task-graph skill 只分发自包含 bootstrap、只读能力、runtime 安装逻辑、精确依赖清单和纯 JavaScript 产物，不在 Git、Git LFS 或 skill zip 中保存 `.node`。
- 采用: task-graph 提供显式 runtime 查询、安装和检查命令；普通查询、mutation、skill updater 和模块导入都不隐式下载依赖，mutation 缺失 runtime 时返回结构化安装指引。
- 采用: 默认 tool home 是用户主目录下的 `~/.tools/task-graph`；非空 `TASK_GRAPH_TOOL_HOME` 完整覆盖默认位置，runtime 按协议版本和锁定清单摘要使用不可变 ID 目录并允许新旧版本并存。
- 采用: 安装使用精确 package lock 和禁用 lifecycle scripts 的 npm clean install，在唯一临时目录完成 native 加载与真实 lock/unlock 探针后原子发布；Node 和 npm 是显式前置条件，不由 task-graph 安装。
- 采用: 并发安装通过唯一临时目录和同一最终 runtime ID 收敛，不额外实现 bootstrap 锁；旧 runtime 不被 updater 或后台任务静默删除。
- 不采用: 项目自建按平台 native artifact、通用外部 runtime 分发工具、可变 `latest` 目录、自动 GC 或 native 加载失败后的第二套锁实现。
