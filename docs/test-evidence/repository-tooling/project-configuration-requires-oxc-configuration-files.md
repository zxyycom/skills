### Case REPO-OXC-CONFIG-001: 项目配置要求 Oxc 配置文件

Entry:
- `scripts/validators/project-config.test.ts > project configuration requires Oxc configuration files`
- `bun test --test-name-pattern="^project configuration requires Oxc configuration files$" ./scripts/validators/project-config.test.ts`

Contract:
- 项目配置校验必须解析并按安装的 Oxc schema 校验根目录 Oxlint 与 Oxfmt 配置；Oxlint 配置必须保持受校验的统一项目基线，不能承接配置级绕过或基线降级。基线与局部例外路径由[编码规范](../../coding-style.md#7-oxlint-例外保持局部且可审计)承接。

Proves:
- 缺少根目录配置的项目会分别报告 `.oxlintrc.json` 与 `.oxfmtrc.json` 路径和恢复动作。
- 字段类型错误或根结构错误的配置会在正式校验中被拒绝。
- 当前有效配置可以通过；即使安装版本的 Oxlint schema 接受，配置级路径或规则绕过以及已选基线降级仍会在正式校验中被拒绝，并给出局部例外的替代处置。
