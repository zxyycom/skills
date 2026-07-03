# 2026-07-01 - 不用脚本校验 workflow 结构

## 状态
- 当前状态: active
- 导致状态变化的决策: 无
- 状态说明: 作为当前项目校验脚本边界使用。

## 问题
- 用 TypeScript validator 解析或正则匹配 GitHub Actions workflow, 会把 workflow 结构重复表达在脚本里。
- 这类检查容易变成对代码结构的二次维护, 让真实 workflow、文档约定和校验脚本三处同时漂移。

## 决定
- 采用: 校验脚本只检查仓库长期源文件、skill 入口、Markdown 链接、决策记录和 package script 等项目约束。
- 采用: Workflow 的具体步骤、发布门禁和权限配置不由脚本解析或正则检查。
- 不采用: 用代码检查 workflow 结构或把 workflow 发布契约复制进 validator。
- 触发条件: 后续新增或调整 workflow 时, 通过文档、review 和 GitHub Actions 运行结果确认行为。

## 影响
- `scripts/validators/project-config.ts` 不再包含 workflow 结构正则或 YAML 解析检查。
- 主仓库发布入口是否正确, 不通过 validator 复制 workflow 结构来判断。
- `AGENTS.md` 保留稳定边界, 不写 workflow 文件名、hash 文件或具体发布步骤这类工具链细节。

## 验证
- `scripts/validate.ts` 不调用 workflow 结构校验。
- `docs/tooling.md` 记录 workflow 校验边界。
