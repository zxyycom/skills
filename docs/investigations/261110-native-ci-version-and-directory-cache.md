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

Windows 失败的直接原因是正式构建入口使用固定的 `0.2.1`，而冻结源码的 Cargo package 已为 `0.2.2`；构建后校验二进制版本因此拒绝。修复改从冻结 Cargo package 解析正式版本，并贯通构建、证据、资产复用、在线检查和 workflow；旧版本字节不能仅靠改名冒充新版本。此轮原生版本更新为 `0.2.3`，两个 skill 分别为 116 和 105，源码与描述符经公开生成入口绑定。

Linux 失败说明测试没有观察到预期符号链接，日志不足以确定唯一原因。目录成员缓存以身份及时间判断有效，文件系统时间精度不足时，新成员与已缓存目录可能呈现相同版本，是可行机制。定向测试明确将旧目录列表的版本设置成当前版本，模拟时间戳碰撞；修复在缓存未列出所选成员但真实成员已存在时刷新目录，再按类型检查。该测试可确定性覆盖碰撞机制，不证明原 CI 实际发生了该碰撞，也不概括所有并发文件变更。

本地 Linux 使用源码摘要 `2f556caf3107dfc9cddfd905d2cfad24c87ce985ee957168decdbb9f31b288d2` 的 0.2.3 候选：Cargo 全目标测试、24 项原生发布运行时测试、5 项离线交付测试和私有 fixture smoke 均通过。项目快照列出 1421 个本机实体且账本覆盖通过；Windows 条件编译节点不在 Linux 快照中，不以此声称 Windows 节点已运行。MSVC all-targets 交叉检查通过，存在测试模块 unused-import warning，不替代 Windows 原生运行。Windows 下缓存中的错误大小写别名仅在能证明同一单链接普通文件或目录时复用原目录事实，避免为每个别名重复枚举；身份未知或多链接时仍保守刷新。

首次修复提交 `c8bb5594` 的 [CI 运行 42757771504](https://github.com/zxyycom/skills/actions/runs/42757771504) 中，Linux 原 native 测试失败点及 formal build 已通过，package 通过；[Windows job 129636076647](https://github.com/zxyycom/skills/actions/runs/42757771504/job/129636076647) 的新目录大小写预算测试因 fixture 使用非法 owner `Chosen` 而失败，错误发生在路径合法性检查，不能据此认定生产目录缓存失败。测试改用合法 owner `chosen` 下的 `Nested` 目录和实际子文件，逐个先断言 ID 合法，仍分别检查文件与目录大小写及目录枚举预算。Linux 定向验证 8 个 ID 和 4 个资源测试通过；Windows 原生执行仍待下一次 CI。

该后续改动仅涉及测试，保持原生版本 0.2.3；两个 skill 因随包描述符身份变化分别升至 117 和 106。新的本地源码摘要为 `39d05f0479080465d4fecd1fe0cf0d66f15cdb7f19543ca71bf08f9fae7531e0`，与上一段 0.2.3 本地候选的摘要区分。远端 CI 和发布结果仍待后续提交实际验证，不将本地通过等同远端成功。
