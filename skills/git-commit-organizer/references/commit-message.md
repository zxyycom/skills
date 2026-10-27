# 提交类型与信息

本文件承接提交语义分类与消息格式；范围、快照和完整工作流由 [Git Commit Organizer](../SKILL.md) 承接。

## 提交类型

类型只表达本次提交的主语义，不承接提交粒度、stage 范围或正文写法。

本风格使用以下类型：

1. `feat`：新增用户可见能力、正式行为、产品能力或对外可感知流程。
2. `fix`：修复错误、冲突、不一致、回归、兼容性问题或错误的既有行为。
3. `plan`：整理规划、方案、OpenSpec change、proposal、design、tasks、实现路线或审计结论。
4. `spec`：调整协议、schema、契约、示例语义、验收标准或其他可验证规格。
5. `test`：新增或调整测试、fixture、测试数据、验证脚本或测试策略本身。
6. `docs`：只调整说明性文档，且不改变产品契约、规格能力、实现行为或验证规则。
7. `ai`：只调整 AI/agent 配置，例如模型、工具、MCP/app 连接、权限、运行参数或配置化 prompt。
8. `refactor`：调整代码结构、命名、拆分或内部组织方式，且不改变外部行为。
9. `chore`：通用维护、依赖、元数据、仓库整理或非 AI 专属配置。
10. `build`：调整构建、打包、发布产物生成或发行流程。
11. `ci`：调整持续集成、workflow、自动化门禁或检查任务。

选择规则：

1. 当多个类型都可能适用时，选择后续阅读提交历史时最需要追踪的语义影响。
2. 只影响 AI/agent 配置时，使用 `ai`，不归入 `chore`。
3. Skill 说明、agent 协作规则、OpenSpec、schema、示例和测试策略不因服务 AI 而使用 `ai`；按实际语义选择 `plan`、`spec`、`docs` 或 `test`。
4. 在 AI 主导或规格先行项目中，`docs/`、OpenSpec、schema、示例和测试策略可能是项目计划或产品契约本身；优先使用 `plan` 或 `spec` 表达语义，不默认使用 `docs`。

## 提交信息传递

1. 优先使用 `git commit -m "type：标题" -m "正文"` 通过命令参数传入提交信息。
2. 正文包含多条 bullet 时，第二个 `-m` 参数必须包含实际换行，例如：
   ```sh
   git commit -m "fix：修复提交正文" -m "- 第一条改动
   - 第二条改动"
   ```
3. 不要在 `-m` 参数中写 `\n`、`/n` 或 `\\n` 期待 Git 把它们转换成换行；shell 会把这些字符原样传给 Git，提交正文就会变成单行并包含字面量转义文本。
4. 如果当前命令传递环境无法保留上例中的实际换行，才使用临时提交信息文件配合 `git commit -F <file>`；不要为了坚持 `-m` 而写入字面量转义文本。
5. 不默认用 stdin 传入提交信息。

## 提交信息模板

```text
plan：整理 CLI 参数兼容 change 说明

- 优化 standardize-cli-unknown-argument-compatibility 的目标、范围和影响说明
- 明确 warning 在 readable-json 与 protocol-json 等输出层的承载边界
- 同步核心 CLI change 的未知参数兼容和 protocol-json schema 边界
```
