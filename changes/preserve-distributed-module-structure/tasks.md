# Tasks

先完成 0.1–0.3，再以 Change Plan CLI 完成 1.1–1.3 的最小切片；试点通过后推广到其余工具和 updater。
1.7–1.9 随每批实现同步推进，2.1–2.6 随对应实现验证，最后由 2.7 汇总验收；证据记录在对应条目下。

## Readiness

- [x] 0.0 完成计划审计门禁：核对目标、范围、owner、成功标准覆盖、执行顺序与授权边界；
  通过主线程 AI 阅读回放、Change 结构检查与仓库门禁，确认可从 0.1 直接推进。
  - 语义证据：六项成功标准均由实现和验证任务承接；独立安装、宿主复用、包内改码、更新和依赖
    恢复均能从设计定位前置、操作与验收。方案选择已收敛，技术核验由 0.1–0.3 承接。
  - 机械证据：`bun run change-plan -- check changes/preserve-distributed-module-structure`、
    `bun run change-plan -- check-all`、`git diff --check` 与 `bun run check` 通过；
    仓库门禁采用增量执行与既有通过证明复用。
- [ ] 0.1 列出领域工具与 updater 的入口、公开类型、源码/资源闭包、直接依赖及 native/optional
  契约，标明调用方的 TS 路径调整；清单保存到 design 的实施观察。
- [ ] 0.2 核对 Node engine、固定 pnpm、无默认 workspace 配置文件的独立安装和公开类型解析，
  记录确需项目配置的依赖及原因。
- [ ] 0.3 记录同步/测试耗时、bundle 和 Node 进程次数，确定最小 smoke 与成本预算；
  复核其他活动 Change 对 SDK/工具源码的影响。

## Implementation

- [ ] 1.1 实现 TS/资源复制、TS 入口与必要类型/Schema 生成；sync/check 共用受管集合，
  保持模块关系与追溯，适配 TS 导入路径和生成头，按设计清理过期生成物。
- [ ] 1.2 建立运行时 manifest、独立 pnpm 锁文件与随包 `.gitignore`，
  按[依赖与安装设计](design.md#依赖与安装)验证安装参数和按需配置。
- [ ] 1.3 完成 Change Plan CLI 试点及调用方调整，证明独立安装、兼容宿主复用和就地修改直接生效，
  通过后进入后续工具迁移。
- [ ] 1.4 迁移 Decision Records、Investigation Report 和 Test Evidence，
  同步 CLI/SDK 的 TS 路径、必要类型和 Schema。
- [ ] 1.5 迁移 Task Graph、Skill Validator、Lightweight Judgment、Novel Cards 和
  MCPShell Workspace Bridge，处理多入口、资源及 native/optional 契约。
- [ ] 1.6 将 updater 改为 TS，补齐依赖声明、自更新加载处理和安装/重新获取的恢复指引。
- [ ] 1.7 更新 hash/zip、独立版本与制品校验，排除安装产物并提升实际受影响 skill 版本。
- [ ] 1.8 更新根稳定命令、Gate impact/生成前置和 CI 准备，使验证消费可信的分发内容。
- [ ] 1.9 同步仓库模型、工具链、skill/help、updater 和局部契约，维护必要 Decision、Case 与索引。

## Verification

- [ ] 2.1 在干净目录解包真实 skill，按固定 pnpm frozen 安装运行；锁文件不变，
  修改包内业务 TS 后无需构建即可观察变化。
- [ ] 2.2 验证依赖不可解析/不兼容、manifest-lock 不一致与安装失败的诊断和恢复指引；
  普通 import 无 CLI、文件/网络副作用，启动和检查不隐式安装。
- [ ] 2.3 验证宿主兼容依赖与锁文件版本不同、本地依赖目录缺失时仍可运行；
  两份独立安装使用不同依赖版本，重装互不改写。
- [ ] 2.4 验证 TS CLI 的真实 argv、输出/退出状态、公开导入和独立消费者类型检查，
  覆盖资源、多入口、调用方路径及 native/optional 能力。
- [ ] 2.5 验证已有安装更新、依赖重装和失败重试，文件覆盖/保留符合 updater 契约；
  核对知识型 skill 指令使用与 TS updater 各自的前置说明。
- [ ] 2.6 核对正式制品、Git 忽略、生成漂移和版本/hash；验证按需配置及纯 TS 运行内容，
  强制暂存安装产物仍不能发布，Case/index 引用与覆盖一致。
- [ ] 2.7 运行受影响的 `test:*`、`check:*`、`bun run check` 和 release Gate，
  对照成本预算，说明新增 smoke 的独有证据及未覆盖的平台/网络边界。
