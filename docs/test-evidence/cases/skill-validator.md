# Skill Validator

### Case SKILL-VALIDATOR-PORTABLE-001: 可移植 skill 通过源码与 CLI 校验
Entry:
- `tools/skill-validator/tests/run.ts > validator accepts a portable skill with bundled and CLI parity`
- `bun test --test-name-pattern="^validator accepts a portable skill with bundled and CLI parity$" ./tools/skill-validator/tests/run.ts`
Contract:
- 结构和链接合法的可移植 skill 必须通过源码、bundled API 与 CLI。
Proves:
- 三个入口均成功且报告相同 Markdown 文件数量。

### Case SKILL-VALIDATOR-DIAGNOSTICS-001: 无效 metadata、目录与链接可诊断
Entry:
- `tools/skill-validator/tests/run.ts > validator reports invalid metadata, directories, and links`
- `bun test --test-name-pattern="^validator reports invalid metadata, directories, and links$" ./tools/skill-validator/tests/run.ts`
Contract:
- Validator 必须报告 frontmatter、保留目录形态和 Markdown 链接错误。
Proves:
- 每类无效输入都产生可定位诊断和失败退出码。

### Case SKILL-VALIDATOR-ENTRY-STATES-001: 缺失、空与损坏入口可诊断
Entry:
- `tools/skill-validator/tests/run.ts > validator reports missing, empty, and malformed skill entries`
- `bun test --test-name-pattern="^validator reports missing, empty, and malformed skill entries$" ./tools/skill-validator/tests/run.ts`
Contract:
- `SKILL.md` 缺失、无可执行正文或 frontmatter 损坏必须分别诊断。
Proves:
- 三类入口状态都不会被误判为有效 skill。

### Case SKILL-VALIDATOR-CLI-ARGS-001: Validator CLI 帮助与参数错误稳定
Entry:
- `tools/skill-validator/tests/run.ts > validator CLI help and argument errors use stable exit contracts`
- `bun test --test-name-pattern="^validator CLI help and argument errors use stable exit contracts$" ./tools/skill-validator/tests/run.ts`
Contract:
- Validator CLI 的帮助和参数数量错误必须使用稳定退出契约。
Proves:
- Help 成功输出用法，多余参数以参数错误退出。

### Case SKILL-VALIDATOR-GENERATED-001: Validator 生成制品公开声明与来源
Entry:
- `tools/skill-validator/tests/run.ts > generated validator artifacts expose declarations and portable metadata`
- `bun test --test-name-pattern="^generated validator artifacts expose declarations and portable metadata$" ./tools/skill-validator/tests/run.ts`
Contract:
- Validator 分发制品必须暴露声明、公共 API 和可移植来源元数据。
Proves:
- 生成脚本、声明及 source map 包含约定导出和仓库相对路径。
