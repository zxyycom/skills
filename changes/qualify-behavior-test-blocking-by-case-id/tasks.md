# Tasks

本清单只保存从当前 draft 进入可实施 plan 所需的就绪条件、实施顺序和验证出口；已确认产品方向不再作为待选择事项，所有 Implementation 与 Verification 项都需要后续实施授权。

## Readiness

- [x] 0.1 恢复调查基线：稳定 `test:*` 容器、最小原生 Test/Case、现行 catalog 边界、聚合退出码、quick/full check 与 CI 消费路径。
- [x] 0.2 固定产品语义：只有可描述、可审计并关联 Case 的 Test 才有行为阻断资格；非法测试以 `test-integrity` 硬阻断但不计为行为回归。
- [x] 0.3 固定共同协议：正式测试 producer 输出版本化标准 JSON，test-evidence consumer 只支持该协议，不逐 runner 适配。
- [x] 0.4 固定事实源与 owner：Test ID/发现、Case `Tests:` 关系、JSON producer、test-evidence consumer、check 和 CI 各自只有一个责任边界；Test 实体与 Case 不保存单次运行状态，也不建立第二 Case 映射。
- [ ] 0.5 等待并审阅 `task-000035` 的最终 Test ID、locator、测试发现新鲜度和 `sourceRevision` 契约，确认本 change 只消费而不复制其 owner。
- [ ] 0.6 用 Bun 与 Node native test 的真实事件收敛 JSON Schema、闭合状态、producer error、试点容器和回退条件，并确认 proposal、design 与 tasks 指向同一可实施结果。

## Implementation

- [ ] 1.1 在 test-evidence 可分发能力边界定义版本化 JSON Schema、兼容策略、stdout/stderr 纪律、invocation、Test result、producer error、diagnostics 和固定 reason code；协议不保存 Case ID 或 runner 专属事件。
- [ ] 1.2 建立唯一严格 consumer：读取一个 JSON 文档，校验版本、Schema、invocation 和预期/实际 Test ID 集合，从同一 ledger 快照派生 Case ID，复核 revision 并输出固定分类；不加入 runner 专属分支。
- [ ] 1.3 为选定试点 runner 建立边缘 producer，完整列出本次实际产生的原生 Test 运行结果，并使每项恰好映射为一个携带 Test ID 的协议结果；runner 专属事件读取、结果映射和原始诊断只留在 producer。
- [ ] 1.4 建立试点稳定 `test:*` 资格链路：生成资格快照与预期集合，传入 invocation，捕获 producer stdout/stderr/transport，交给 consumer，并让直接 script 与 check 只消费最终分类。
- [ ] 1.5 收口正式阻断面：显式分类 check 测试步骤，拒绝没有合格 JSON 的新增 `test:*` 或 CI 测试旁路，同时保留非测试工程检查的独立类别。
- [ ] 1.6 以试点证据逐个迁移其余稳定 `test:*`，覆盖 Bun 与 task-graph Node native test；新增 runner 只能增加 producer，不能修改 consumer 的领域分支。
- [ ] 1.7 全部正式入口迁移后移除裸 runner 阻断路径，同步 `package.json`、test-evidence skill/tool、`docs/tooling.md`、项目协作说明与 CI 消费边界，并完成必要版本提升和生成物更新。

## Verification

- [ ] 2.1 用 runner-agnostic consumer fixtures 证明多个 producer 的同版本合法 JSON 得到相同分类；本次全部实际原生结果都绑定唯一 Test ID，问题 Test 实体先被识别，再派生非空 Case ID。
- [ ] 2.2 证明空 stdout、混杂日志、多个 JSON 值、NDJSON、语法错误、未知版本、Schema 非法和 invocation 错配都固定归入协议完整性错误，不触发 TAP/JUnit/console fallback。
- [ ] 2.3 证明未登记成功/失败结果、无 ID、未知/重复 Test ID、只报告问题项、额外结果、预期缺失、空 Case 关系和过滤预期集合分别得到确定的 `test-integrity` 诊断；无 ID 结果不伪造 Case 关联，原始 fail 不被误报为行为回归。
- [ ] 2.4 证明测试实体陈旧、ledger 不闭合和运行期间 revision 漂移在行为分类前失败，并保留项目 revision、实体指纹和 Case revision 证据。
- [ ] 2.5 证明 producer/runner 无法启动、被外部终止或超时属于基础设施失败；producer 返回但无合格 JSON 属于协议完整性错误；完整合法 JSON 中的 Test fail 才属于行为回归。
- [ ] 2.6 证明只删关系、只删实体和只删实现均由相应闭合/新鲜度检查阻断；完整删除实现、实体和关系不触发虚假结构错误，且没有新增 tombstone 或第二 manifest。
- [ ] 2.7 证明试点稳定 script、`bun run check` quick、`bun run check --full` 和 Package Skills CI 共用同一 consumer 与分类；raw runner 和新增无 producer 的测试入口没有正式阻断资格。
- [ ] 2.8 对每个迁移容器核对预期 Test ID 与 producer JSON 实际集合，记录性能和选择器边界；无法唯一绑定的容器停止迁移，不能为迁移它而扩展 consumer 场景分支。
- [ ] 2.9 运行受影响目标测试、类型检查、项目配置检查、test-evidence 严格检查和 `bun run check --full`；确认不存在第二 Case 关系源、runner 专属 consumer 或未授权的 `task-000026/000035` owner 重写。
