---
title: 以双平台产品门禁共同约束聚合发布
id: 261024-require-windows-video-acceptance-for-aggregate-release
status: active
alignment: unaligned
createdAt: 2026-10-24T10:17:11Z
purpose: 保持Linux全仓质量，并在Windows真实制品验收后交付视频能力。
background: 视频包含Windows媒体调用与路径行为，仅Linux门禁不能证明目标平台分发可用。
decision: Linux完整门禁与Windows视频源码及同次制品验收共同阻断PR合并和整批skills发布。
tags:
  - project-tooling
  - release-safety
  - video-understanding
relations: []
---

## 目的

- 让 `skills/video-understanding/` 的 Windows 调用和独立制品在交付前具有可重复证据，同时保持 Linux 全仓完整质量标准。
- 让维护者明确产品门禁、PR 合并保护和聚合发布分别由谁约束，不以单个平台的局部成功代替其他义务。

## 背景

- 视频工具包含 Windows 路径、媒体子进程、资源和配置处理；Linux 源码测试不能覆盖这些目标平台行为。相反，Windows 视频测试也不承担全仓工具、质量材料和其他 skill 的兼容性。
- 仓库使用单条聚合发布链。另建视频发布机制会扩大维护面；接受 Windows 视频失败同时阻断其他 skill 的发布，可以继续共用既有版本、制品和发布事务。
- 待验收对象既包含同 revision 源码，也包含实际分发 zip。工作树复制或另一次打包不能证明 Linux job 上传制品在 Windows 中可用。

## 决策

- 采用: 本仓库是视频源码、通用测试、产品文档和平台验收的唯一维护 owner；宿主项目维护自己的稳定包接入、消费验证和报告约定。通用 TS 分发遵循[既有判断](distribute-editable-typescript-runtimes.md)。
- 采用: Linux `package` 持续执行完整 release Gate；Windows `video-windows` 在每次既有 PR、main 和手动 workflow 中执行视频源码测试，以及同次 Linux job 的实际 zip 验收。两者使用同一受测 revision，不用路径过滤或成功跳过缩小必需验收。
- 采用: Windows 制品在无祖先依赖的仓库外目录显式 frozen 安装，分别验证 Node/Bun、路径和资源、配置、失败与进程清理、依赖及离线 updater 保留；fixture 仅证明实际断言的可观察边界。
- 采用: `publish` 同时依赖两个产品门禁；任一失败、取消或缺失成功结果都阻断整批 skills 发布。PR 远端必需检查同时要求二者，维护者必须核对实际 check 身份和 ruleset／分支保护；没有配置权限或平台能力时保持合并阻断。
- 采用: 工作流、合并保护和本地验收分别取得证据；文档和 YAML 不证明远端已经执行或生效。真实媒体、网站、模型、客户端发现与 OCR 资格按授权单独实测，不因此扩大其他 skill 或平台的支持声明。
