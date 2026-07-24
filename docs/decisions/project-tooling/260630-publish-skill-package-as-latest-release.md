---
title: 使用 latest release 自动发布 skill 制品
status: archived
alignment: null
createdAt: 2026-07-18T11:43:07+08:00
purpose: 集中重复的 skill 校验与打包工具链，并提供统一的聚合发布入口。
background: 多个 skill 子仓库有重复的校验、打包和发布脚本，继续分散维护会让同一套工具链在多个仓库漂移。
decision: 主仓库 CI 在所有触发场景运行校验、打包和 workflow artifact 上传。
relations: []
---

## 目的
- 集中重复的 skill 校验与打包工具链，并提供统一的聚合发布入口。

## 背景
- 多个 skill 子仓库有重复的校验、打包和发布脚本，继续分散维护会让同一套工具链在多个仓库漂移。
- 主仓库已经通过 `.gitmodules` 统一组织 skill 子仓库，因此制品交付入口也应由主仓库统一承接。

- 本仓库使用 submodule 管理多个 skill 子仓库，skill 本体位于各子仓库的 `skill/<skill-name>/`。
- 主仓库负责共享脚本、CI 和维护文档；子仓库尽量只保留 skill 本体。
- 项目没有独立版本号和发布清单，因此按每次提交创建不可变版本 release 会增加维护成本。
- PR 应只验证候选改动，不应发布制品。

1. 先确认重复点：各 skill 仓库的校验、打包和 release workflow 基本一致。
2. 再确定 owner：既然主仓库已经负责组织多个 skill 子仓库，共享工具链应上收到主仓库。
3. 发布入口选择固定 `skills-latest` release，让每次 `main` 发布覆盖同名 assets。
4. 为避免 PR 获得不必要发布权限，将打包 job 和发布 job 分离，只有发布 job 使用写权限。

## 决策
- 采用: 主仓库 CI 在所有触发场景运行校验、打包和 workflow artifact 上传。
- 采用: `main` 分支的 `push` 和 `workflow_dispatch` 额外发布或更新 GitHub Release `skills-latest`。
- 采用: release tag 指向最新发布提交，release assets 覆盖为当前 `dist/*.zip`。
- 不采用: 为每个 skill 子仓库保留重复 CI 和打包脚本；共享工具链变化时会造成多处同步成本。
- 不采用: 为每次提交创建新的 release；当前仓库没有版本命名和变更说明机制，会把交付入口变成流水账。
