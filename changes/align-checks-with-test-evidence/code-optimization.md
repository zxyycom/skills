# 编码规范优化交接

本文件只承接 `align-checks-with-test-evidence` 最终验收前的编码维护性优化；随本 Change 结项清理，不是长期规则或新的正确性审查报告。未暂存、提交、推送、安装依赖或启动全仓 Gate。

## 结论与实际优化

只优化一处局部数据表达，没有新增 helper、类型框架或产品抽象：

- `tools/task-graph/tests/generated-artifacts-distribution.test.ts` 的 SDK 声明节点，在读取时直接形成 `{ filename, source }`，而不是维护文件名/内容两个平行数组、再靠索引和非空断言配对。
- 同一对象供声明树内容聚合和相对声明引用检查使用，路径与内容的对应关系局部可见，符合编码规范的领域含义与局部可推理要求。
- 保留排序、并行读取、完整声明文本、根声明、全部断言及真实 tsgo consumer；没有改变原生节点名称、粒度、证明责任、时间预算、Check 数或产品语义。

本轮写入文件完整列表：

1. `tools/task-graph/tests/generated-artifacts-distribution.test.ts`。
2. `changes/align-checks-with-test-evidence/code-optimization.md`。

目标文件原有 diff 属于 graph-evidence handoff 的测试拆分；本轮没有覆盖它的拆分、断言或其他已有改动。

## 核对范围与保留理由

已读取 AGENTS、navigation、repository-model、coding-style、tooling 的相关边界、test-design、test-evidence-review，以及五份 handoff 的实现/验证交接。CodeGraph status 成功；新增 catalog symbol 搜索未命中，随后按明确路径读取当前 diff，未把索引结果当作最新源码证明。

维护性核对聚焦本 Change 的新增/变化责任，而非再次逐项审查产品正确性：

- Gate 的声明式 Check、依赖及版本身份沿现有 owner 直接维护；没有必要将新增两项显示名判断拆成通用命名框架。
- catalog 的 AST 输入采集只承接当前原生聚合接线，外部 JSON 已通过 Valibot；不为一个测试局部流程抽出通用 AST/进程层。
- 环境 fake tools 的命令记录在既有 POSIX/Windows dispatcher 中表达，CP Git 环境在现有临时目录作用域恢复；不将两种不同 fixture 生命周期机械合并。
- TG native child、LJ child/server、DR/IR 锁场景已在局部显式保存结束观察、放行/关闭及 finally；没有仅为减少相似语句引入共享并发框架或改变 deadline。
- TE 临时目录登记沿既有 tool-local afterEach；MCPShell 同步交错沿已有 fake SSH/wc seam。不把这些不同清理或注入责任提取成跨工具 helper。
- DR index/date 的显式字面原生注册是当前 snapshot 可定位性的已验证承诺；保留其必要重复，不退回动态名称或 tuple 注册。
- 共同事务/source 测试的归属与源码/分发测试分界保持既有交接结果；没有修改节点或重做产品抽象。

未因命名偏好、行数、重复语法或格式一致性扩大改动。`impact-tools.ts`、`impact-catalog.ts`、混写的 DR wrapper/run、`index-runtime/tests/run.ts`、其他会话 source-frontmatter/owned-envelope 测试、产品 `src`、skill 生成物、Case/index 和长期 docs 均未写入。

## 实际验证

环境：固定 Bun 1.4.2 / Node 24.18.0 PATH，`TMPDIR=/var/tmp`；原生节点验证另设 `CI=true`。

| 命令 | 本轮结果 |
| --- | --- |
| `node_modules/.bin/oxfmt --check tools/task-graph/tests/generated-artifacts-distribution.test.ts` | 1 文件格式通过，无格式写入。 |
| `node_modules/.bin/oxlint --type-aware tools/task-graph/tests/generated-artifacts-distribution.test.ts` | exit 0，无规则豁免。 |
| `git diff --check -- tools/task-graph/tests/generated-artifacts-distribution.test.ts` | exit 0。 |
| `bun test ./tools/task-graph/tests/generated-artifacts-distribution.test.ts -t '^generated SDK declarations support public type consumers without leaking private APIs$'` | 1 pass / 3 filtered / 0 fail，实际执行真实 tsgo consumer，约 3.02s。 |

没有发生目标测试首次失败或重试。一次查找当前 Case 中新节点名/ID的 `rg` 没有匹配并退出 1，这是 Case 整合尚在进行的读取结果，不是 lint/测试失败；随后独立重验并明确打印 lint、diff-check 的 exit 0。

## 证据交接与未覆盖

- 当前文件四个原生节点名称及实体 ID 均不变；SDK 节点仍证明公开类型消费、私有 API 隐藏和声明引用有效。没有需要修改的 Contract/Proves。
- 已通知 root 与 Case owner：本轮源码变化使之前的 sourceRevision 不能继续冒充最终快照，最后须重新生成公共 snapshot；无需为本次表达优化变更实体定位。
- 本轮没有运行全项目 typecheck、完整 test:check、check:changed、release 或 Windows 验收，亦未做变异验证；由 root 在稳定工作区集中执行。这一局部通过不代替 Change 的最终验收。
- 无本轮新增后台进程或额外临时证据目录留存。

## 最终 Gate 定向修复后的补充复核

### 结论与范围

后续隔离验收暴露文件/函数指标和人工 run 输入归属问题后，原 Gate owner 已完成定向修复。本次只复核其维护性，不再次实施源码优化；**没有需要继续修改的编码规范问题**。不为制造改动增加抽象，也不将本节当作重新进行产品正确性审查或全量验收的结论。

实际读取了当前 staged/unstaged 状态、五个指定测试文件及 diff，以及 `gate-handoff.md` 的“隔离 staged snapshot 验收后的定向修复”追加。另只读核对 `impact-check-responsibilities.test.ts` 的 run 归属回归、`checks/package-script.ts` 的两个 catalog 能力订阅和 `scripts/vibe-check.test.ts` 的新叶子接入。CodeGraph 对既有 `passedDefinition` 及新 performance 文件 import 定位成功；当前表达及改动归属仍以实际源码/diff为准。

### 保留当前表达的具体依据

- `vibe-check-native-selection.test.ts` 留下真实选择/文件行为；`vibe-check-native-policy.test.ts` 承接独立配置政策。新文件直接完成局部结构收窄和独立字面断言，不复制原文件整套通用读取 helper，也不为两个政策节点建立共享 schema/断言框架。
- `vibe-check-profiles.test.ts` 继续承接 scope/quick selection/receipt；`vibe-check-cli-performance.test.ts` 集中三个 CLI 性能消费意图，复用已有 `passedDefinition`、临时目录和原生 Run seam。输入时钟、duration 数组与期望结果在各测试现场可见，没有把政策判断转移到新 helper，也没有以真实等待代替受控事实。
- `impact-input-ownership.test.ts` 的三个原生节点分别表达 runtime 传播、adapter-helper 隔离、domain 路径矩阵；各自拥有独立 fixture。拆分边界由独立证据意图支撑，而非机械按行数拆内部步骤，不需要再次合并或抽出统一遍历/断言层。
- 两个新叶子通过既有测试聚合的显式 import 注册；run 输入回归直接列出真实 consumer execute 和非 consumer reuse 的观察。catalog 的能力订阅沿既有声明式表表达，没有新推断框架或无关领域接线。
- 本次维持修复后的节点名称、1→3 的证明分界、新输入回归、政策字面预期、算法和预算；未改 Check/receipt 数。已知 file/function 阈值不是新增放宽或 waiver。

### 本次实际验证与边界

固定 Bun1.4.2 / Node24.18.0 PATH、`TMPDIR=/var/tmp` 下：

- 对指定五个测试文件运行 `node_modules/.bin/oxfmt --check`：5 文件通过，exit 0，无格式写入。
- 对同五文件运行 `node_modules/.bin/oxlint --type-aware`：exit 0，无 lint 豁免。
- 对五文件及上述 run 归属回归/订阅/聚合接入共八文件运行限定 `git diff --check`：exit 0。

Gate owner 在 handoff 中记录的 **27 pass / 0 fail / 0 skip**，以及当前项目原生 file/function metrics 对九文件 **0 finding / 0 blocking finding**，属于该 owner 的实际运行证据，本次没有重复执行或冒称自己运行。未运行全 Gate、上游算法复测、全项目 typecheck、Windows 或新 mutation。

本次唯一写入是本文件追加；未改任何测试源码、混写文件、产品、Case/index 或 Git index。没有因本次复核额外引入的源码 revision 变化；Case owner 继续按 Gate owner 已实施的移动、拆分和新增节点维护最终 snapshot/Case，即可，不需为本次文字交接另改实体或 Proves。
