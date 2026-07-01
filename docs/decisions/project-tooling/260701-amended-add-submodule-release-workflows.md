# 2026-07-01 - 给子仓库增加独立 release workflow

## 状态
- 当前状态: amended
- 导致状态变化的决策: [2026-07-01 - 不用脚本校验 workflow 结构](260701-active-avoid-workflow-structure-validation.md)
- 状态说明: 子仓库保留自身发布流程的规则仍然生效；原记录中由主仓库校验脚本检查子仓库发布 workflow 的做法已取消。

## 问题
- 只有主仓库发布 `skills-latest` 时, 使用者必须从聚合 release 获取单个 skill 或 skill 集合, 子仓库本身没有独立交付入口。
- 子仓库已经是独立 GitHub 仓库, 当某个子仓库的 `skill/` 内容变化时, 需要能直接在该子仓库发布对应包。
- 旧规则为了避免工具链重复, 倾向不在子仓库保留 CI 和发布流程; 这与独立子仓库 release 入口的需求冲突。

## 决定
- 采用: 每个子仓库保留 `.github/workflows/publish-skill-package.yml`, 只负责该子仓库 `skill/` 内容的校验、打包、latest release 发布和 hash 写回。
- 采用: 子仓库根目录保留 `skill-package.hash`, 记录最近一次成功发布的 `skill/` tree hash。
- 采用: 子仓库 workflow 用 `git rev-parse HEAD:skill` 计算发布 hash, 不复制主仓库 TypeScript 脚本, 不安装 Bun/pnpm 工具链。
- 采用: 子仓库 release tag 使用 `<repo-name>-latest`; 多 skill 子仓库发布该仓库内全部 `skill/*` zip。
- 采用: 主仓库仍保留聚合发布; 子仓库独立发布入口由文档约定、review 和 GitHub Actions 运行结果维护。
- 不采用: 只依赖主仓库聚合 release; 这不能满足按子仓库独立获取发布包的需求。
- 不采用: 在子仓库复制主仓库共享脚本和依赖工具链; 这会重新引入多处脚本维护成本。
- 触发条件: 后续只要子仓库仍作为可独立安装的 skill 或 skill 集合仓库, 就保留自身最小 release workflow。

## 影响
- 子仓库不再被要求“只保留 skill 本体”; 发布 workflow 和 hash 文件成为允许存在的仓库级文件。
- 主仓库和子仓库 release 并存: 主仓库提供全部 skill 聚合入口, 子仓库提供自身 skill 集合入口。
- 新增 skill 子仓库时, 除主仓库聚合打包外, 还要同步配置该子仓库自己的 release workflow 和 hash 基线。

## 验证
- 三个 submodule 都包含 `.github/workflows/publish-skill-package.yml` 和 `skill-package.hash`。
- `docs/tooling.md` 记录子仓库独立发布规则。
- 子仓库发布入口通过 review 和 GitHub Actions 运行结果确认。
