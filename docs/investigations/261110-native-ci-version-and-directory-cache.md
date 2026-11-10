---
title: "原生记录工具 CI 版本与目录缓存失败"
id: "261110-native-ci-version-and-directory-cache"
formedAt: "2026-11-10T04:30:45Z"
question: "为何原生构建在 Linux 测试和 Windows 版本验收分别失败，修复证据与边界是什么？"
tags:
  - "ci"
  - "record-cli"
  - "resource-cache"
relations: []
---

## 形成时背景

2026-11-10，用户报告提交 `614f4964` 的 [GitHub Actions 运行 42754825186](https://github.com/zxyycom/skills/actions/runs/42754825186) 未完成原生发布。package 与 video-windows 任务成功，native-build 的 Linux、Windows 两个任务失败，publish 因依赖未满足而跳过。本轮与 [0.2.2 性能调查](./261110-native-full-check-io-costs.md) 分开记录：该报告的测量仍对应当时资产，不代表此次修复版本的性能。

## 调查目的

区分两个失败的直接证据与可复现机制，修复原生发布版本身份和资源目录安全检查，并以本地检查及后续 CI 实际结果分别验收；不把本地测试当作远端发布成功。

## 调查范围与依据

通过 `gh run view --log-failed` 读取上述运行失败日志： [Linux job 129626699248](https://github.com/zxyycom/skills/actions/runs/42754825186/job/129626699248) 的 native 测试 154 通过、1 失败，`src/resources/tests.rs:96` 断言结果应包含 `symbolic link` 而失败；日志未记录当时目录时间或 issues 内容。[Windows job 129626699242](https://github.com/zxyycom/skills/actions/runs/42754825186/job/129626699242) 在正式冻结输入构建时报 `built binary version mismatch: decision-records`，此前原生与 updater 测试通过。日志保留在关联运行页面，非本报告的本地附件。

本轮检查正式冻结源码版本、构建、恢复复用、在线验收与 workflow 接线，以及资源目录事实缓存和目标类型检查；实现测试分别使用固定版本输入、私有 Git 或目录 fixture。实际跨平台 CI 运行和发布以其运行结果为准。

## 调查结果与边界

Windows 失败的直接原因是正式构建入口使用固定的 `0.2.1`，而冻结源码的 Cargo package 已为 `0.2.2`；构建后校验二进制版本因此拒绝。修复改从冻结 Cargo package 解析正式版本，并贯通构建、证据、资产复用、在线检查和 workflow；旧版本字节不能仅靠改名冒充新版本。最终原生版本为 `0.2.3`，Decision 和 Investigation skill 分别为 117 和 106，源码与描述符经公开生成入口绑定。

Linux 失败说明测试没有观察到预期符号链接，日志不足以确定唯一原因。目录成员缓存以身份及时间判断有效，文件系统时间精度不足时，新成员与已缓存目录可能呈现相同版本，是可行机制。定向测试明确将旧目录列表的版本设置成当前版本，模拟时间戳碰撞；修复在缓存未列出所选成员但真实成员已存在时刷新目录，再按类型检查。该测试可确定性覆盖碰撞机制，不证明原 CI 实际发生了该碰撞，也不概括所有并发文件变更。

Windows 下缓存中的错误大小写别名仅在能证明同一单链接普通文件或目录时复用原目录事实，避免为每个别名重复枚举；身份未知或多链接时仍保守刷新。首次修复提交的 [CI 运行 42757771504](https://github.com/zxyycom/skills/actions/runs/42757771504) 中，Linux 原失败测试与 formal build 已通过；Windows 新预算测试因 fixture 使用非法 owner `Chosen` 在路径校验处失败，而非证明生产缓存失败。随后测试改用合法 owner 下的子目录，并先逐个断言资源 ID 合法，保留文件、目录大小写与枚举预算验证。

最终提交 `01233d5580c4d0c7d4d382a7f27773a73880c67c` 的 [CI 运行 42758512827](https://github.com/zxyycom/skills/actions/runs/42758512827) 已成功：package、Linux 和 Windows native-build、video-windows 与 publish 均通过。Windows 原生日志显示目录大小写预算测试通过，lib 测试 154 通过、0 失败，集成测试、formal build 和私有 fixture smoke 通过。本地四个相关 scope 加 quick 共 25 项通过、38 项未选；MSVC 交叉检查另有测试模块 unused-import warning，不作为 Windows 原生运行的替代证据。

实际核对的 [skills-latest 发布](https://github.com/zxyycom/skills/releases/tag/skills-latest) 指向上述提交；发布 manifest 中两个 skill 的版本为 117 和 106，runtimeVersion 均为 0.2.3，源码摘要均为 `39d05f0479080465d4fecd1fe0cf0d66f15cdb7f19543ca71bf08f9fae7531e0`。四个平台角色运行时 ZIP 的大小和 SHA-256 与发布资产匹配，构建证明和恢复包均存在。

原 Linux 失败的时间戳碰撞仍是可复现的可能机制，而非日志已证实的唯一原因。此次 Windows CI 是真实平台运行，但不证明原 376 份记录的性能，也不证明真实用户目录安装：普通 push 的 accept-online 被跳过，未执行线上隔离安装验收。
