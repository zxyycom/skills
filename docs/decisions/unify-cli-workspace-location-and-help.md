---
title: 为领域 CLI 统一工作区定位与帮助契约
id: 260922-unify-cli-workspace-location-and-help
status: active
alignment: aligned
createdAt: 2026-09-22T05:53:39Z
purpose: 让同一调用结构在不同领域 CLI 之间可复用，工作区定位、帮助和路径错误的语义不因工具而不同。
background: 领域 CLI 曾各自决定全局选项位置、缺少 command 的行为和领域目录约束；同一调用形态需要按工具分别记忆，集合目录误传给 --root 时也缺少直接的恢复路径。
decision: 领域 CLI 统一全局选项位置、工作区根默认值、相对领域目录约束和帮助行为，路径错误按当前参数形态给出恢复诊断。
tags:
  - decision-records
  - project-tooling
relations: []
---

## 目的
- 让调用者用同一 argv 结构操作任何领域 CLI：在目标工作区内执行时省略定位参数，跨工作区调用才显式给出工作区根。
- 让路径角色稳定：脚本安装位置只定位可执行文件，进程当前目录是默认工作区根，工作区根解析领域目录，领域目录始终是工作区内相对路径。

## 背景
- 领域 CLI 曾各自决定全局选项位置、缺少 command 的行为和领域目录约束，同一调用形态需要在工具之间分别记忆。
- 集合目录被误传给 `--root` 时，旧诊断缺少直接的恢复形态；绝对领域目录还让单次调用越过工作区边界定位集合。

## 决策
- 采用: 领域 CLI 公开 `<cli> [global-options] <command> [command-options]`、`help [command]` 与 `<command> --help`；全局选项可以位于 command 之前或 command options 之后，规范示例放在 command 之前。
- 采用: 省略 `--root` 时以 `process.cwd()` 为工作区根；`--root` 只表示工作区根，工具不执行向上搜索或隐式发现。
- 采用: 领域目录只接受解析后仍位于工作区内的相对路径；绝对路径与越界相对路径按普通参数错误失败，不保留别名、兼容分支或迁移提示。
- 采用: help 只解析请求并渲染静态命令信息，不读取集合状态；缺少 command 时渲染顶层帮助并以参数错误退出。
- 采用: `--root` 指向领域集合目录时，诊断给出 `--root <workspace> --<collection>-dir <relative-collection>` 的恢复形态。
