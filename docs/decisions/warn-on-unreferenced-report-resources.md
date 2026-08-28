---
title: 只提醒未引用的报告资源
status: active
alignment: aligned
createdAt: 2026-08-28T10:12:57Z
purpose: 让报告资源池卫生问题持续可见，但只用阻塞级校验保护已经进入报告证据关系的资源。
background: 未引用文件可能是待接入或待清理材料；新 owner 由报告 ID 而非主题路径推导，不能因此把无关资源状态升级为集合错误。
decision: 被引用资源继续严格校验，完全未引用的版本控制可见资源只产生 warning，ignore 排除的未跟踪噪声不提示。
tags:
  - investigation-report
relations:
  - type: 修订
    target: warn-on-unreferenced-investigation-resources.md
---

## 目的
- 对已经成为报告证据的资源保留阻塞级完整性保证。
- 让尚未进入报告关系的资源保持可发现，但不因准备或清理滞后阻塞 check 与 sync-index。
- 按报告级 owner 和既有版本控制可见性边界区分有意管理的材料与 ignore 排除的本地噪声。

## 背景
- 报告显式引用会让资源成为可复核证据；缺失、不安全、不可分发或 owner 报告错误会直接破坏报告复核。
- 完全未引用的文件尚未形成证据关系，warning 足以暴露卫生问题；将其视为错误会把资源池维护扩大为所有报告操作的前置。
- owner 路径从 topic 改为 Investigation ID stem，不改变版本控制可见资源与 ignored 未跟踪噪声之间的诊断边界。

## 决策
- 采用: 报告显式引用的资源继续执行阻塞级校验，包括 owner 报告结构与 owner 引用、路径安全、精确大小写、存在性、普通文件身份和版本控制可见性。
- 采用: 默认全量 check 发现版本控制可见但没有任何报告引用的资源时输出 warning；warning 不使 check 或 sync-index 失败。
- 采用: 未引用资源的 owner 报告尚不存在，或资源自身存在非法类型、非法 owner 结构或安全路径问题时，同样只以 warning 暴露；一旦报告引用该路径，相应问题升级为硬错误。
- 采用: 按既有版本控制可见性规则，被 ignore 排除的未跟踪文件不产生完全未引用资源 warning，报告引用它时失败；tracked 或显式进入 pending 的 ignored 文件继续作为可见资源校验。
- 采用: scoped check 只验证命中报告及其直接引用，不证明跨报告 owner 或全局完全未引用资源状态；默认全量 check 与 sync-index 才建立完整引用集合。
- 采用: 领域结果分别表达 errors 与 warnings，CLI 同时展示但只由 errors 决定失败。不增加自动删除、自动暂存、warning 抑制清单或资源清理生命周期。
