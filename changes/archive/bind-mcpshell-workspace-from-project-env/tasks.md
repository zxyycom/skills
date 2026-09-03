# Tasks

本 Change 已完成 agent 项目配置契约、核心 skill 阅读路径与关联 bridge 事实的同步。

## Readiness

- [x] 0.1 确认 skill、项目级 MCP 配置与本机 env 都属于 agent 项目，目标工作区由 backend 绑定。
- [x] 0.2 确认 Node `.mjs`、同目录资源定位、完整 command/patch 字符串和双向文件流的运行时基线。
- [x] 0.3 确认真实环境连接、SSH、Git apply、结果协议和文件传输的验证边界由关联 bridge 与使用环境分别承担。

## Implementation

- [x] 1.1 重构核心 `SKILL.md` 的术语、配置边界、初始化流程、失败恢复和当前交付边界；version `4` 覆盖本次内容。
- [x] 1.2 新增同目录 `.gitignore` 与 `.env.mcpshell.example`，使本机绝对路径不进入 Git。
- [x] 1.3 同步 README 与人类介绍，以 AI 工具选择为正文重心。
- [x] 1.4 同步 helper Change，固定 Node、自定位、项目级配置及字符串/字节数据路径的当前事实。

## Verification

- [x] 2.1 验证 AI 能从实际文本恢复两个项目边界、配置 owner、四项工具分工和 `outcome_unknown` 的核验动作。
- [x] 2.2 运行单 skill、两项 Change、Markdown/diff 与全仓检查，并审阅没有真实密钥、路径或环境文件进入跟踪内容。
