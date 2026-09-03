# Tasks

本 Change 先交付 AI 可消费的核心 skill 与辅助实现契约；任务完成不代表真实 provider 或 SSH bridge 已经交付。

## Readiness
- [x] 0.1 建立目标 AI、实际入口、预期操作和可观察结果。
- [x] 0.2 确认四项 convenience tools 的首选用途、合法替代路径和固定 roots。
- [x] 0.3 确认核心 skill 与辅助 provider 的 owner 和分发边界。

## Implementation
- [x] 1.1 按“取得 tools—按用途选择—继续原任务”重构 `SKILL.md` 主线。
- [x] 1.2 定义 shell、apply-patch、put 和 get 的输入、结果与失败边界。
- [x] 1.3 定义现有 tools 复用、provider 初始化、会话重载和原任务恢复路径。
- [x] 1.4 同步 UI metadata、`AGENTS.md`、`README.md` 和人类介绍。
- [x] 1.5 向辅助工具 Draft 交接 command、patch 和双向单文件 transport 的实现义务。
- [x] 1.6 合并重复负向规则，使当前契约只描述有效行为、必要边界和事实缺口。

## Verification
- [x] 2.1 验证文件查看、文本修改、双向文件传输、现有工具复用和 provider 缺失路径可从实际文本恢复。
- [x] 2.2 检查主承诺与篇幅重心，并确认每项负向规则都有当前判断或安全价值。
- [x] 2.3 运行单 skill、updater、Change Plan、diff 与全仓检查。
