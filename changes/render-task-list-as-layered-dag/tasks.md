# Tasks

本清单按“契约就绪 → list projection → layout/renderer → CLI 输出选择 → owner/分发同步 → 行为与交接验证”排序；实现、证据和成功标准全部成立后才进入归档审阅。

## Readiness

- [x] 0.1 已核对 proposal、design 和 tasks：三者都以 raw result object 为共同输入，以 task-list renderer 为默认 list 输出，并以 `--json` 选择通用 serializer。
- [x] 0.2 已核对 `skills/task-graph/SKILL.md`、task-graph 领域决策、`TaskGraphService.listTasks`、`runTaskGraphCli` 和当前生成声明；当前事实、受影响 owner 与源码/生成边界一致。
- [x] 0.3 已确认 `Open Questions` 无阻塞项，并把“track 不是可并行集合”“exclusion 只禁止同时运行”“其他 command 暂不增加 renderer”固定为 review 门禁。
- [x] 0.4 已建立影响矩阵：service/graph 测试承接 list projection，新增 layout/renderer 测试从 `tests/run.ts` 导入，`cli.test.ts` 承接 format，`generated-artifacts.test.ts` 承接分发；每个新增或改名的最小 `test()` 节点分别进入 `docs/test-evidence/task-graph/`。
- [x] 0.5 已统一 raw result object、list projection、JSON serializer、task-list renderer、track、dependency layer、run mutex pair 和 active mutex blocker 的含义；三个 artifact 不再依赖对话中的术语修正。
- [x] 0.6 已建立 AI 消费契约：后续 agent 只凭本 change 与直接引用 owner，应能恢复目标、输出架构、信息取舍、实现顺序和验证出口。

## Implementation

- [ ] 1.1 在 `tools/task-graph/src/service.ts` 及相邻公开类型中建立明确的 list item projection：保留既有摘要字段，增加有效 dependencies、exclusions、children、dependents 与 blockers，并维持 task ID 字典和确定性排序。
- [ ] 1.2 在独立 task-list layout 模块中实现纯派生：用 parent/child 与有效 dependency 计算 tracks，用 dependency DAG 计算 layers，按最小 task ID、layer、parent path 与 task ID 排序，并保证每个 task 只出现一次。
- [ ] 1.3 实现 task-list renderer 的摘要、track 与 node 层次；按固定 node grammar 显示显式 parent、needs、补充因果信息的 blocker、非空 next action 和 title，并折叠 reverse relation 与重复 inheritance source。
- [ ] 1.4 实现 `RUN MUTEX`：把 effective exclusion 规范化为无向 pair、对称去重并按左 endpoint 分组；只在 blocker 实际生效时给受阻 task 增加行内 `mutex:[task-id]` 并计入 `mutex-blocked` task 数。
- [ ] 1.5 实现标准/窄两档布局、endpoint continuation、可注入 columns 和非 TTY 的 80 列回退；不使用 box drawing、ANSI 颜色、Unicode padding 或 title 后字段。
- [ ] 1.6 重构 CLI 输出阶段，使 dispatch 先构造 raw `TaskGraphResult`，再按 command path 与 format 选择 JSON serializer 或 task-list renderer；按 design 固定 list failure 的默认字段与 details 排序。
- [ ] 1.7 为全局参数增加不可重复、无值且可位于 command 前后的 `--json`；确保全部 success/failure/help/version 在该模式下执行 `JSON.stringify(result) + LF`，并保持 stderr 与退出码契约。
- [ ] 1.8 更新 help catalog、公开导出和声明源，使 global option、list projection 与程序化 API 一致；不得把 track、layer、摘要或 render context 暴露为持久领域状态。
- [ ] 1.9 更新 `skills/task-graph/SKILL.md` 与 `docs/skills/task-graph.md`，说明默认 list、raw `--json`、track/layer、运行互斥和信息折叠；按 decision-records 的独立演进边界维护长期判断。
- [ ] 1.10 新增或调整 projection、layout、renderer 与 CLI 测试，按每个最小原生测试入口维护 `docs/test-evidence/task-graph/` case，并同步派生测试证据索引。
- [ ] 1.11 通过 `scripts/build/task-graph.ts` 同步 `skills/task-graph/scripts/` 的 ESM、source map、公开声明与声明树；检查无手工生成文件改动，并按分发内容变化提升 task-graph skill 独立版本。

## Verification

- [ ] 2.1 以多 track、单链、分支、汇合、跨 parent dependency、多层 parent 和终态 task fixture 验证 track/layer、每 task 一次和稳定排序。
- [ ] 2.2 验证 renderer 的信息层次与固定 node grammar：显式 parent/dependency 不依赖缩进，title 后没有字段，next action 与因果 blocker 按条件出现，reverse relation 与 inheritance source 不重复展开。
- [ ] 2.3 以无 exclusion、对称重复、祖先继承、同 track pair、跨 track pair、密集 pair、running 对端和 recovery-needed 对端验证 mutex 规范化、endpoint 分组和 active blocker。
- [ ] 2.4 对 columns `79`、`80`、缺失 columns 的非 TTY、中文、emoji、长 title、四个以上 endpoints 和深 parent 验证两档输出及 continuation；确认无 ANSI、box drawing 或 Unicode padding。
- [ ] 2.5 验证 `task list` 默认 renderer、默认 list failure 与 `task list --json` raw serialization；覆盖 `--json` 前后位置、重复/带值错误、help、version 和其他 command，并核对每种输出只有一个结果和一个末尾 LF，以及 revision、错误码、stdout/stderr 与退出码。
- [ ] 2.6 验证程序化 `listTasks()`、JSON serializer 和 task-list renderer 消费同一 list projection；serialization 保留既有字段及关系来源、继承路径和 blockers，且不包含 track、layer、摘要或预格式化文本。
- [ ] 2.7 运行 task-graph 源码测试、生成同步与无漂移检查、公开声明检查、test-evidence 同步/检查、decision check、`validate`、`typecheck`、skill hash、打包检查和 `bun run check --full`，记录实际结果。
- [ ] 2.8 进行一次隔离交接审阅：让未使用对话上下文的实现视角只读取本 change 与直接引用 owner，并确认能够准确回答 raw output flow、node 字段顺序、track/layer 关系、mutex 去重、宽度回退、兼容出口、改动 owner 和验证命令。
- [ ] 2.9 对照 proposal 的全部 Success Criteria、更新后的行为 owner 和长期决策审阅最终实现；只有默认 renderer、raw serialization、文档、生成产物和证据都成为当前事实后，才进入决策对齐与 change 归档准备。
