---
title: 独立命令执行下保留 Release 版本管理隔离
id: 261020-retain-release-version-control-isolation
status: active
alignment: aligned
createdAt: 2026-10-20T07:38:42Z
purpose: 让 Git 子进程密集测试保持独立失败归因，并避免与其他 Release CPU 工作竞争。
background: 独立原生命令取代共享批次后，版本管理测试的资源竞争风险仍不因执行容器变化消失。
decision: 版本管理测试保持独立命令和全部 Release CPU 容量，其他任务遵守统一资源预算与原生调度。
tags:
  - concurrency
  - environment-isolation
  - project-tooling
  - version-control
relations:
  - type: 修订
    target: 260912-isolate-release-version-control-resource-boundary
    summary: 保留版本管理CPU独占和诊断边界，将其从批次例外改为独立命令体系内的资源政策
---

## 目的

- 保留 Git 子进程密集测试的独立失败归因和稳定重跑路径。
- 在独立命令执行模型中继续隔离 Release CPU 竞争，不因执行容器简化放宽已建立的资源边界。

## 背景

- 前序基于版本管理测试跨提交间歇失败、并发压力显著变慢及共享 transcript 诊断不足，采用了独立执行和全部 CPU 容量；现有证据未将竞争确定为唯一根因。
- Gate 现以独立原生命令承接每项测试，原共享批次的执行与结果投影不再需要，但 Git 子进程密集负载和同类并发竞争仍然存在。
- 原生 named resources 可以在 admission 到 settlement 期间原子持有 claims；learned strategy 只应优化合法 ready task 的顺序，不能越过隔离约束。

## 决策

- 采用: `test:version-control` 保持稳定人工 package script、base 项目 Check 和 release-required Check，Gate ID 为 `script:test:version-control`；以独立 `commandCheck` 执行，保留直接重跑命令和独立 transcript。
- 采用: Release 保持四个 `cpu-work` unit；版本管理 Check 同时占一个 `external-process` 和全部四个 CPU units，其余实际 Check 各占一个 CPU unit 并保留原有 claim。因此版本管理测试不与其他声明 CPU 工作的 Check 并发。
- 采用: root 并发四项、外部进程容量三、仓库扫描容量二继续作为硬预算；独立命令各自声明真实消耗，不以并行测试文件数量替代 Check 资源责任。
- 采用: 时长比较身份覆盖任务结构、执行方式、profile 与容量，策略变化后不误用不兼容 history。可丢弃 learned history 只影响选择偏好，不影响 membership、outcome 或 aggregate。
- 采用: 后续独立 transcript 若稳定定位到产品断言缺陷，修复缺陷并重新评估隔离；只有可用 CPU、测试负载或同类测量实质变化时才调整容量或 claims，不能仅凭一次通过解除隔离。
