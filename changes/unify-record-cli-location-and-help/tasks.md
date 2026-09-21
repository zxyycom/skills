# Tasks

任务先固定 argv 与路径矩阵，再调整两个解析入口，最后验证帮助、定位和分发文档的一致性。

Readiness 复核项是本 Change 的实施前审计门禁；未勾选的前置项未满足前，不得开始对应实施任务。

## Readiness

- [x] 0.1 建立两个 CLI 的 command、global option、help、缺少 command、重复参数和 `--` 终止符行为矩阵，并标出目标差异。
- [x] 0.2 盘点 location API、仓库短命令、skill 示例和绝对领域目录消费者，确认需要修改的稳定 owner。
- [x] 0.3 查找适用的长期 Decision，并确认 argv、location 与 help 对应的 Test Evidence Case 和最小测试入口。

## Implementation

- [ ] 1.1 让 Decision Records parser、location API、help 和退出码符合共同 argv 与工作区定位契约。
- [ ] 1.2 让 Investigation Report 改用 Commander，并使 location API、help 和退出码符合相同契约，同时保留领域 command handler。
- [ ] 1.3 为两个领域统一相对领域目录规范化、工作区 containment 和路径误用诊断。
- [ ] 1.4 移除无 command 默认执行、绝对领域目录和旧 help 解析分支，使公开命令只呈现目标语法；旧命令与旧参数只走普通无效输入路径，不增加兼容或迁移特判。
- [ ] 1.5 更新两个 skill、人类入口、受影响的仓库短命令和长期 Decision，规范示例优先省略 `--root`。
- [ ] 1.6 新增或调整 argv、help、cwd 默认值、跨工作区、绝对路径、越界路径和集合目录误用测试，并同步 Test Evidence。
- [ ] 1.7 提升受影响 skill 版本并通过两个 `sync:*` 入口更新分发制品。

## Verification

- [ ] 2.1 运行两个 CLI 目标测试，覆盖 command 前后全局选项、help、不完整调用、重复参数、退出码，以及旧命令和旧参数没有兼容或迁移专用分支。
- [ ] 2.2 在临时工作区执行默认 cwd、显式 `--root`、自定义相对领域目录和三类路径错误的双领域 A/B。
- [ ] 2.3 运行两个生成漂移检查、`typecheck`、`lint`、领域检查与 Test Evidence 检查。
- [ ] 2.4 运行 `bun run check`，并审阅 help、skill 示例和仓库短命令没有残留冲突。
