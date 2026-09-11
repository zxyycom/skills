# Tasks

任务按已确认契约、领域实现、生成同步与可审计验证推进；最终正确性阅读单独保留到主线程验收。

## Readiness
- [x] 0.1 核对 Git 状态、仓库规则、Change Plan、编码规范、两个 trace owner 与历史示例，确认 corrective 范围不改变 selection 或 JSON API。
- [x] 0.2 建立 Draft artifacts，记录文本关系图与 `--json` 双输出的已确认历史契约、owner、非目标和风险。
- [x] 0.3 扫描 Decision 与 Investigation trace 的 CLI、输出、测试、生成与 Test Evidence 入口，形成实施分工和受影响最小测试清单。

## Implementation
- [x] 1.1 为 Decision trace 增加 `--json` 分流和默认终端文本图；保持成功 JSON envelope 与失败通道不变。
- [x] 1.2 为 Investigation trace 增加 `--json` 分流和默认终端文本图；保持成功 JSON envelope 与失败通道不变。
- [x] 1.3 覆盖稳定图层、trace/context 标记、事件上下文、relation summary、frontier、blockedEvent 和 `--json` 的领域回归测试。
- [x] 1.4 同步两个 skill 的行为入口、固定契约、help、版本与生成分发制品。
- [x] 1.5 按修改后的最小测试入口维护 Test Evidence Cases 与索引。

## Verification
- [x] 2.1 运行 Decision 和 Investigation 目标测试、CLI 参数/通道验证及生成一致性检查。
- [x] 2.2 运行受影响 skill validate、领域 check、Test Evidence check 与 `bun run check`、`bun run check --full`。
- [x] 2.3 审阅双 renderer 的契约一致性、确定性、无多余抽象和正确性；保留最终主线程验收结论后勾选。
