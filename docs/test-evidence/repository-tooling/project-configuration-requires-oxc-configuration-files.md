### Case REPO-OXC-CONFIG-001: 项目配置要求 Oxc 配置文件

Entry:
- `scripts/validators/project-config.test.ts > project configuration requires Oxc configuration files`
- `bun test --test-name-pattern="^project configuration requires Oxc configuration files$" ./scripts/validators/project-config.test.ts`

Contract:
- 项目配置校验必须解析并按安装的 Oxc schema 校验根目录 Oxlint 与 Oxfmt 配置，避免维护命令和正式门禁接受无效配置。

Proves:
- 缺少根目录配置的项目会分别报告 `.oxlintrc.json` 与 `.oxfmtrc.json` 路径和恢复动作。
- 字段类型错误或根结构错误的配置会在正式校验中被拒绝。
