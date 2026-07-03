# 2026-06-30 - 使用 latest release 自动发布 skill 制品

## 状态
- 当前状态: amended
- 导致状态变化的决策: [2026-07-01 - 使用 skill hash 门禁 latest release 发布](260701-amended-gate-latest-release-by-skill-hash.md), [2026-07-01 - 给子仓库增加独立 release workflow](260701-superseded-add-submodule-release-workflows.md), [2026-07-01 - 不用脚本校验 workflow 结构](260701-active-avoid-workflow-structure-validation.md), [2026-07-01 - 用 Git hook 更新 package hash](260701-amended-update-package-hash-with-git-hooks.md), [2026-07-01 - 使用版本化 release 发布 skill 制品](260701-amended-publish-versioned-skill-releases.md), [2026-07-02 - 迁移为 skills 单仓库布局](260702-active-use-monorepo-skills-directory.md)
- 状态说明: 主仓库统一打包仍然生效；发布触发条件已改为当前 skill hash 与上一提交 hash 不一致，hash 文件由提交前 hook 维护并由 CI 校验。固定 `skills-latest` 不再是唯一发布记录，只作为兼容下载入口保留；子仓库独立发布入口已被单仓库布局替代。

## 问题
- 多个 skill 子仓库有重复的校验、打包和发布脚本，继续分散维护会让同一套工具链在多个仓库漂移。
- 主仓库已经通过 `.gitmodules` 统一组织 skill 子仓库，因此制品交付入口也应由主仓库统一承接。

## 背景与约束
- 本仓库使用 submodule 管理多个 skill 子仓库，skill 本体位于各子仓库的 `skill/<skill-name>/`。
- 主仓库负责共享脚本、CI 和维护文档；子仓库尽量只保留 skill 本体。
- 项目没有独立版本号和发布清单，因此按每次提交创建不可变版本 release 会增加维护成本。
- PR 应只验证候选改动，不应发布制品。

## 决策过程
1. 先确认重复点：各 skill 仓库的校验、打包和 release workflow 基本一致。
2. 再确定 owner：既然主仓库已经负责组织多个 skill 子仓库，共享工具链应上收到主仓库。
3. 发布入口选择固定 `skills-latest` release，让每次 `main` 发布覆盖同名 assets。
4. 为避免 PR 获得不必要发布权限，将打包 job 和发布 job 分离，只有发布 job 使用写权限。

## 决定
- 采用: 主仓库 CI 在所有触发场景运行校验、打包和 workflow artifact 上传。
- 采用: `main` 分支的 `push` 和 `workflow_dispatch` 额外发布或更新 GitHub Release `skills-latest`。
- 采用: release tag 指向最新发布提交，release assets 覆盖为当前 `dist/*.zip`。
- 不采用: 为每个 skill 子仓库保留重复 CI 和打包脚本；共享工具链变化时会造成多处同步成本。
- 不采用: 为每次提交创建新的 release；当前仓库没有版本命名和变更说明机制，会把交付入口变成流水账。
- 触发条件: 后续只要仍以统一最新 skill 包集合为交付目标，保留 latest 兼容入口；版本化 release 已由后续决策引入。

## 影响
- 使用者可以从固定 release 获取最新全部 skill zip，不需要进入每个子仓库或单次 workflow run 查找 artifact。
- PR 验证和 main 发布的权限边界更清晰。
- 子仓库可以减少重复工具链文件，只保留 skill 本体。

## 验证
- `.github/workflows/package-skills.yml` 包含 `publish` job，只在 `main` 分支的 `push` 和 `workflow_dispatch` 发布。
- `docs/tooling.md` 记录 artifact 与 latest release 的职责。
- 发布契约由 `.github/workflows/package-skills.yml`、`docs/tooling.md` 和后续 review 共同确认。
