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

- 采用: 本仓库单一维护视频源码、通用测试、产品文档和平台验收；宿主项目维护稳定包接入、消费验证和报告约定。通用 TS 分发遵循[既有判断](distribute-editable-typescript-runtimes.md)。
- 采用: Linux `package` 保持完整 release Gate；Windows `video-windows` 验证同 revision 源码与同次 Linux job 的实际 zip。两者覆盖每次既有 PR、main 和手动 workflow，必需验收不以路径过滤或成功跳过替代。
- 采用: Windows 对实际 zip 进行仓库外、无祖先依赖的显式 frozen 安装，验证 Node/Bun、路径／资源、配置、失败与进程清理、依赖及离线 updater 保留。真实分发与源码分别取证，避免工作树依赖掩盖制品缺陷。
- 采用: 两个门禁共同约束单条聚合发布链和 PR 合并；任一失败、取消或缺少成功结果都阻断交付。`publish` 同时依赖二者，远端规则将二者的实际 check 身份设为必需；权限或平台能力不足时保持合并阻断。接受 Windows 视频失败阻断其他 skill 发布的耦合，以复用既有发布事务。
- 采用: 工作流、远端合并保护和本地验收分别取得生效证据。fixture 仅证明实际断言，真实媒体、网站、模型、客户端发现与 OCR 资格按授权另验，其他 skill 与平台的支持范围保持不变。

执行入口与远端保护核对由[项目工具链](../tooling.md#ci-与发布)承接，制品验收步骤由[视频工具维护](../../tools/video-understanding/README.md#windows-开发与制品验收)承接。
