# Skills

这个仓库是 Codex skills 的主仓库，用 Git submodule 组织多个 skill 子仓库，并在主仓库集中维护共享脚本、CI、维护文档和发布流程。

## 项目定位

`skills` 保留多仓库结构：每个子仓库是独立 skill owner，主仓库通过 `.gitmodules` 固定它们的入口和版本指针。

同时，重复的项目级能力不再分散在每个子仓库中。共享校验、打包、发布、工具链说明和长期维护文档由主仓库承接；子仓库尽量只保留 `skill/` 下的 skill 本体和随 skill 分发的文件。

## 目录结构

- `.gitmodules`: 子仓库入口和远端 URL。
- `.github/workflows/`: 主仓库统一 CI，用于校验、打包并发布全部 skill 制品。
- `AGENTS.md`: Codex agent 维护本仓库时的项目级指令。
- `docs/`: 主仓库维护文档和决策记录。
- `package.json`: 本地校验、打包和交付准备脚本入口。
- `scripts/`: 主仓库共享自动化脚本。
- `prompt-optimize/`: `prompt-optimize` skill 子仓库。
- `git-commit-organizer/`: `git-commit-organizer` skill 子仓库。
- `openspec-skills/`: OpenSpec workflow skills 集合子仓库。

## 当前 Skills

- `prompt-optimize/skill/prompt-optimize/`: 结构化文本优化 skill。
- `git-commit-organizer/skill/git-commit-organizer/`: Git 提交整理 skill。
- `openspec-skills/skill/openspec-propose/`: 创建 OpenSpec change artifacts。
- `openspec-skills/skill/openspec-apply-change/`: 根据 OpenSpec change 推进实现。
- `openspec-skills/skill/openspec-archive-change/`: 归档已完成的 OpenSpec change。
- `openspec-skills/skill/openspec-explore/`: 围绕 OpenSpec change 调查事实、澄清问题和比较方案。

## 使用方式

首次拉取主仓库后初始化子仓库：

```bash
git submodule update --init --recursive
```

安装主仓库共享工具依赖：

```bash
pnpm install
```

校验全部 skill 和主仓库维护文档：

```bash
bun run validate
```

打包全部 skill：

```bash
bun run pack:skills
```

完整检查：

```bash
bun run check
```

打包产物输出到 `dist/<skill-name>.zip`，不提交到仓库。

## 维护约定

1. 子仓库保存 skill 本体；共享脚本、CI、依赖、发布流程和维护文档放在主仓库。
2. 新增 skill 子仓库时，先更新 `.gitmodules`，再确认 `scripts/validate.ts` 和 `scripts/pack-skills.ts` 能发现对应 `skill/<skill-name>/SKILL.md`。
3. 更新子仓库内容时，先在子仓库提交并推送，再回到主仓库提交 submodule 指针。
4. 不在每个子仓库重复维护同一套 `package.json`、`scripts/`、`.github/` 或项目级工具链说明。
