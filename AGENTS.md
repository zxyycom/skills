# Agent Instructions

## 项目边界

1. 本仓库是 Codex skills 的主仓库，只维护子仓库索引、workspace 配置和项目级说明。
2. `prompt-optimize/`、`git-commit-organizer/`、`openspec-skills/` 是 Git submodule。skill 内容应在对应子仓库内修改、提交和推送。
3. 主仓库提交子仓库版本变化时，只提交 submodule 指针和必要的主仓库元数据。

## 维护原则

1. 修改前先确认当前所在仓库，避免把子仓库内容误提交到主仓库。
2. 更新任一子仓库后，回到主仓库检查 `git status --short`，确认 submodule 指针是否需要提交。
3. 主仓库文档只写长期稳定的工作区和多仓库维护约定；具体 skill 行为写在各子仓库的 skill 本体中。
4. 正文主要使用中文；除用户要求或目标文件已有语言要求外，新增内容保持中文。
