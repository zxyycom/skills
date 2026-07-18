# 2026-07-01 - 给子仓库增加独立 release workflow

## 索引摘要
- 目的: 让每个 skill 子仓库拥有独立的校验、打包和发布入口。
- 背景: 只有主仓库发布 `skills-latest` 时, 使用者必须从聚合 release 获取单个 skill 或 skill 集合, 子仓库本身没有独立交付入口。
- 决策: 每个子仓库保留 `.github/workflows/publish-skill-package.yml`, 只负责该子仓库 `skill/` 内容的校验、打包、latest release 发布和 hash 写回。

## 目的
- 让每个 skill 子仓库拥有独立的校验、打包和发布入口。

## 背景
- 只有主仓库发布 `skills-latest` 时, 使用者必须从聚合 release 获取单个 skill 或 skill 集合, 子仓库本身没有独立交付入口。
- 子仓库已经是独立 GitHub 仓库, 当某个子仓库的 `skill/` 内容变化时, 需要能直接在该子仓库发布对应包。
- 旧规则为了避免工具链重复, 倾向不在子仓库保留 CI 和发布流程; 这与独立子仓库 release 入口的需求冲突。

## 决策
- 采用: 每个子仓库保留 `.github/workflows/publish-skill-package.yml`, 只负责该子仓库 `skill/` 内容的校验、打包、latest release 发布和 hash 写回。
- 采用: 子仓库根目录保留 `skill-package.hash`, 记录最近一次成功发布的 `skill/` tree hash。
- 采用: 子仓库 workflow 用 `git rev-parse HEAD:skill` 计算发布 hash, 不复制主仓库 TypeScript 脚本, 不安装 Bun/pnpm 工具链。
- 采用: 子仓库保留独立 release 入口；当前 tag 规则已由后续决策修订为 `<timestamp>-<hash12>` 版本化 release 加 `<repo-name>-latest` 兼容入口。
- 采用: 主仓库仍保留聚合发布; 子仓库独立发布入口由文档约定、review 和 GitHub Actions 运行结果维护。
- 不采用: 只依赖主仓库聚合 release; 这不能满足按子仓库独立获取发布包的需求。
- 不采用: 在子仓库复制主仓库共享脚本和依赖工具链; 这会重新引入多处脚本维护成本。

## 关系
- 修订: [使用 latest release 自动发布 skill 制品](260630-publish-skill-package-as-latest-release.md)
