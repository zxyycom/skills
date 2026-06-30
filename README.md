# Skills

这个仓库是 Codex skills 的主仓库，用 Git submodule 组织多个可独立维护的 skill 仓库。

## 项目定位

`skills` 不直接维护 skill 本体内容。它负责固定本地工作区布局、记录子仓库入口，并让多个 skill 仓库可以一起拉取、检查和更新。

主仓库只提交项目级说明、agent 指令、workspace 配置和 submodule 指针。具体 skill 行为、打包脚本、CI 和发布流程在对应子仓库内维护。

## 子仓库

- `prompt-optimize/`: 结构化文本优化 skill，来源于 `zxyycom/prompt-optimize`。
- `git-commit-organizer/`: Git 提交整理 skill。
- `openspec-skills/`: OpenSpec propose、apply、archive、explore 四个 workflow skill 的集合仓库。

## 使用方式

首次拉取主仓库后初始化子仓库：

```bash
git submodule update --init --recursive
```

更新全部子仓库到主仓库记录的版本：

```bash
git submodule update --recursive
```

查看子仓库状态：

```bash
git submodule foreach git status --short
```

## 维护约定

1. 主仓库只提交 `.gitmodules`、workspace 配置、项目级说明和 submodule 指针。
2. skill 内容、打包脚本、CI 和 release 逻辑在对应子仓库中维护。
3. 更新子仓库内容时，先在子仓库提交并推送，再回到主仓库提交对应 submodule 指针。
4. 不在主仓库复制子仓库文件，避免同一份 skill 内容出现两个 owner。
