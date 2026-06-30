# Git Commit Organizer

这个仓库用于维护 `git-commit-organizer` Codex skill。

## 项目定位

`git-commit-organizer` 用于审计当前 Git 改动、选择提交类型、stage 相关文件，并按固定中文格式创建提交。

本仓库不是应用项目。主要维护对象是可安装的 skill 包，以及支撑该 skill 长期演进的项目级配置。

## 目录结构

- `.github/workflows/`: GitHub CI，用于校验、打包并发布 skill 制品。
- `AGENTS.md`: Codex agent 维护本仓库时的项目级指令。
- `docs/tooling.md`: 脚本、安装、校验、打包和 CI 的 owner 文档。
- `package.json`: 本地校验、打包和交付准备脚本入口。
- `scripts/`: 项目级自动化脚本。
- `skill/git-commit-organizer/`: 可安装的 skill 包。
- `skill/git-commit-organizer/SKILL.md`: skill 入口和主执行流程。
- `skill/git-commit-organizer/agents/`: skill 关联的 agent 配置。

## 工具链

脚本、依赖安装、校验、打包和 CI 的具体标准由 [docs/tooling.md](docs/tooling.md) 承接。

## 维护约定

skill 本体保持在 `skill/git-commit-organizer/` 下。仓库根目录、`docs/`、`scripts/` 和 `.github/` 只放项目级说明、agent 指令、工具链说明、自动化脚本、CI 和仓库元数据。

项目文档只引用本仓库内的路径。需要说明外部来源、临时调查路径或一次性上下文时，放在对话或提交说明中，不写入长期项目文档。
