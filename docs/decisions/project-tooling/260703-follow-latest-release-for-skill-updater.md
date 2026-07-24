---
status: archived
alignment: null
createdAt: 2026-07-03T10:31:47+08:00
---

# 自更新脚本跟随 latest release 制品

## 索引摘要
- 目的: 让 skill 自更新使用正式发布制品，而不是开发分支快照。
- 背景: 自更新脚本原来默认从主仓库 `main` 分支下载源码 zip 并截取 `skills/<skill-name>/` 目录。
- 决策: skill updater 默认读取主仓库 latest release，并以正式 package lock 和 skill zip 作为远端更新输入。

## 目的
- 让 skill 自更新使用正式发布制品，而不是开发分支快照。

## 背景
- 自更新脚本原来默认从主仓库 `main` 分支下载源码 zip 并截取 `skills/<skill-name>/` 目录。
- 这种做法会让已安装 skill 跟随尚未发布的源码状态, 和主仓库通过 release 交付 skill zip 的契约不一致。
- 使用者执行更新时更应该获得已经通过 CI 校验、打包并发布的制品。

## 决策
- 采用: 自更新模块 `scripts/update-skill.mjs` 默认通过 GitHub Releases API 读取 `zxyycom/skills` 的 latest release，并以该 release 中的正式 asset 作为远端更新输入。
- 采用: 自更新判断优先读取 release 中的 `skill-package-lock.json`；需要覆盖更新或旧 release 缺少 lock asset 时，再下载对应 `<skill-name>.zip` asset。
- 采用: 保留 `--release-tag <tag>` 作为排查和复现入口, 但默认不要求使用者传入 tag。
- 不采用: 继续默认读取 `main` 分支源码 zip; 这会绕过 release 作为正式交付入口的边界。

## 关系
- 修订: [在 skill 包内分发自更新脚本](260701-embed-self-update-script-in-skill-packages.md)
