# Tasks

任务按“已完成的就绪审计 → 批量 revision 读取 → Decision Records 接入 → pending 复用与 no-op → 分发与证据 → 全面验证”推进；任何性能优化都必须先满足 proposal 中受保护的快照与恢复语义。

## Readiness

- [x] 0.1 在隔离克隆中复现单 ID stage，确认无差异结果的 Git 进程数仍随完整决策集合线性增长，并把首要成本定位为 revision 逐文件读取与 pending 逐文件创建 blob，而不是完整领域校验。
- [x] 0.2 核对 `stage-selected-decisions-by-stable-id.md`、`manage-pending-snapshot-writes.md`、Decision Records 规则、版本管理说明、编码规范和生成边界，确认完整集合、共享 pending owner 与 Git 私有表示均不可因性能优化退出。
- [x] 0.3 检查 active Changes 与源码消费者，确认没有另一 Change 修改同一 stage/version-control 性能边界；按 AI-Ready Docs 审计 proposal、design 与 tasks，确认范围、owner、任务依赖、20/25 次 Git 调用门禁和 `Open Questions: 无` 一致，且没有临时状态副本或阻塞实施的歧义。

## Implementation

- [x] 1.1 在 `VersionControlRepository` 增加 `readRevisionFiles(revision: RevisionId, options?: ListVersionControlFilesOptions): Promise<VersionControlFile[]>`，在 Git 实现中复用规范路径、tree record parser 和 batch blob reader，并按 design 固定 scope、排序、模式与失败语义；同步更新 `tools/shared/version-control.md`，保持现有单文件与路径列表契约。
- [x] 1.2 重构 `decision-stage-service.ts` 的 revision 基线读取以消费批量文件集合，删除逐文件并发读取与重复 revision 解析，同时保持目标来源组合、完整索引构造和所选 filesystem 来源复核。
- [x] 1.3 重构 Git `replacePendingFiles` 目标 entry 构造，只复用锁内已验证的 stage-0 普通非可执行同路径同字节 entry，并只为其余目标文件创建 blob。
- [x] 1.4 在 `replacePendingFiles` 中分离 no-op 与 actual-write：no-op 清理未发布锁并直接成功，actual-write 保留 update、读回、发布和恢复；确认现有测试故障注入点没有替代公共失败语义。
- [x] 1.5 对照 `tools/shared/version-control.md` 与两条既有 active 决策审阅最终公共语义；Decision Records skill/references 保持不变。若实现需要改变可观察 stage 行为、expected/readback/recovery 边界或暴露 Git 表示，停止实施并修订本 Change 与长期决策，不在性能改动中隐式放宽。
- [x] 1.6 依次运行 `sync:change-plan-cli`、`sync:decision-records-cli`、`sync:investigation-report-check`、`sync:task-graph-cli`、`sync:test-evidence-cli`，只保留实际变化的生成制品；再运行对应五个 `check:*`，并只为版本承载内容变化的 skill 提升独立版本。
- [x] 1.7 为新增或修改的最小原生测试节点更新对应 Test Evidence case，并同步统一派生索引；测试文件、聚合脚本或性能日志不代替单 case 证据。

## Verification

- [x] 2.1 扩展 `test:version-control`，覆盖批量 revision 读取的全 revision、无匹配结果、单/多 scope、稳定顺序、模式与 SHA、异常 tree/blob，以及 pending entry 复用、no-op、actual-write、expected 冲突、范围隔离、读回和恢复。
- [x] 2.2 扩展 `test:decision-records-cli`，覆盖批量基线后的新增、修改、删除、移动、未选择 filesystem 隔离、完整索引、来源漂移与既有 pending 拒绝，不改变 CLI 输出和退出码。
- [x] 2.3 建立 150/300 文件的 stage 调用计数测试，分别证明 unchanged 不超过 20 次、单 Decision 修改不超过 25 次 Git 调用，并证明计数不含 fixture 建立且目标 pending 字节正确。
- [x] 2.4 在同一环境记录优化前后的 Git 调用直方图和墙钟结果；如可使用真实 Windows 环境则补充复测，否则明确只验证了平台无关调用复杂度和当前运行平台。
- [x] 2.5 运行 `test:version-control`、`test:decision-records-cli`、`test:index-runtime`、`test:change-plan-cli`、`test:investigation-report-check`、`test:task-graph-cli`、`test:test-evidence-cli`，以及 1.6 的五组生成 check、`check:decisions` 和 `check:test-evidence-catalog`。
- [x] 2.6 运行 `bun run typecheck`、`bun run lint`、`bun run format:check` 与 `bun run check --full`，审阅最终 diff、skill 版本、生成产物、测试证据和 pending 范围，并只记录实际通过的结果。

## 验证记录

- 2026-08-23，在当前 Linux 环境以相同的 300 决策 fixture、同一计数包装器和 fixture 建立后才开始计数：`67a5b0d` 基线的 unchanged/单决策修改分别为 1215/1216 次 Git 调用、墙钟 28.898 秒；当前实现为 15/20 次、墙钟 2.156 秒。150 决策的基线为 615/616 次，当前为 15/20 次。
- 计数测试同时断言 unchanged 不产生 pending 差异，单决策修改暂存选中的 Markdown 与 `decision-index.json`。真实 Windows runner 本次不可用，未声称完成 Windows 复测；调用复杂度门禁已在当前平台通过。
- revision 决策范围只有派生 `decision-index.json` 时，stage 在过滤后返回空 Markdown 基线，不将空 `pathScopes` 传给批量读取；独立回归证明可从该基线暂存首个新 Decision 并重建索引。
