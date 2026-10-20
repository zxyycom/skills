# Tasks

先完成 0.1–0.3，再以 Change Plan CLI 完成 1.1–1.3 的最小切片；试点通过后推广到其余工具和 updater。
1.7–1.9 随每批实现同步推进，2.1–2.6 随对应实现验证，最后由 2.7 汇总验收；证据记录在对应条目下。

## Readiness

- [x] 0.0 完成计划审计门禁：关闭设计中的 TS 运行方式选择，核对目标、范围、owner、成功标准
  覆盖、执行顺序与授权边界；通过主线程 AI 阅读回放、Change 结构检查与仓库门禁。
  - 证据：试点及最终集成由独立代理只审正确性，MCPShell ignore和类同名类型问题已修复复核；
    六项成功标准均有本清单证据。最终文档阅读回放、结构/链接与68项完整发布门禁通过，无待决项。
- [x] 0.1 列出领域工具与 updater 的入口、公开类型、源码/资源闭包、直接依赖及 native/optional
  契约，标明调用方的 TS 路径调整；清单保存到 design 的实施观察。
  - 证据：design 的入口/类型/资源/依赖/native 表及位置假设；8文件19个构造参数属性已转换，
    现成编译选项、负向fixture与真实Node验证的覆盖边界已记录。
- [x] 0.2 核对 Node engine、固定 pnpm、无默认 workspace 配置文件的独立安装和公开类型解析，
  记录确需项目配置的依赖及原因。
  - 证据：Node24.18全部9领域真实zip独立frozen/入口与公开类型消费通过；TaskGraph最低Node22.22.2
    的5个分发节点和4个native节点通过。固定pnpm11.7.0，24包均无workspace文件，无新增许可配置需求。
- [x] 0.3 记录同步/测试耗时、bundle 和 Node 进程次数，确定最小 smoke 与成本预算；
  复核其他活动 Change 对 SDK/工具源码的影响。
  - 证据：design 的活动 Change 与预算；正式运行时生成0 bundle、单次AST扫描，最终通用6节点
    热缓存9.24秒、完整Change Plan矩阵59节点13.19秒，符合15秒预算；直接进程计数与新增独有证明已核对。

## Implementation

- [x] 1.1 实现 TS/资源复制、TS 入口与必要类型/Schema 生成；sync/check 共用受管集合，
  保持模块关系与追溯，适配 TS 导入路径和生成头，按设计清理过期生成物。
  - 证据：9个领域adapter与knowledge updater共用完整skill组合；AST复制自有TS闭包，联合生成入口、
    资源、声明/Schema、manifest和ignore；已知旧MJS/map与updater声明清理。全24份联合check通过。
- [x] 1.2 建立运行时 manifest、独立 pnpm 锁文件与随包 `.gitignore`，
  按[依赖与安装设计](design.md#依赖与安装)验证安装参数和按需配置。
  - 证据：24份独立manifest/lock/ignore、固定pnpm11.7.0；9个领域隔离副本实际frozen安装、锁不变，
    均无workspace配置。MCPShell额外保留唯一环境ignore规则；运行和公开类型所需依赖均可独立解析。
- [x] 1.3 完成 Change Plan CLI 试点及调用方调整，证明独立安装、兼容宿主复用和就地修改直接生效，
  通过后进入后续工具迁移。
  - 证据：公开TS入口、领域闭包与updater联合生成、独立manifest/lock/ignore、短命令/help与生成检查落地；
    源码节点与最终6个分发节点通过，包含frozen、独立类型消费者、宿主兼容不同版本、改码生效与不隐式安装。
    独立正确性审查未发现阻断；同步与制品过滤的最小交叉验证通过。
- [x] 1.4 迁移 Decision Records、Investigation Report 和 Test Evidence，
  同步 CLI/SDK 的 TS 路径、必要类型和 Schema。
  - 证据：Decision302、Investigation310、TestEvidence32节点通过；公开TS绑定现有声明并保持运行函数引用，
    机械声明/手维护API与10份TE Schema派生类型沿原owner；独立Node24.18与tsgo消费者通过。
- [x] 1.5 迁移 Task Graph、Skill Validator、Lightweight Judgment、Novel Cards 和
  MCPShell Workspace Bridge，处理多入口、资源及 native/optional 契约。
  - 证据：TaskGraph88节点与Node26/24.18各4个真实native lock节点、Validator11、LJ79、Novel38通过；
    MCPShell33原节点与新增正式ignore/preview节点通过，2个既有真实外部环境集成未配置而跳过。
    全9工具Node24.18隔离frozen/CLI/import/独立公开类型通过；TaskGraph类类型、stripInternal边界与函数/类
    引用同一性通过；两份SQL与MCPShell四命令YAML生成检查通过，不改变native独立安装责任。
- [x] 1.6 将 updater 改为 TS，补齐依赖声明、自更新加载处理和安装/重新获取的恢复指引。
  - 证据：24 个 skill 已联合同步 TS updater、完整领域/共享闭包与依赖并集；显式刷新知识型 skill
    和 Change Plan 的锁文件后，`bun run check:skill-updaters` 只读检查通过。公开 entry/config factory
    无同步副作用，运行时接收公开入口自身 URL；加载失败保留诊断并提示显式 frozen 安装或重新获取。
    24 个 SKILL 的自更新前置、updater help 和源码 README 已区分指令使用、运行依赖与恢复。
- [x] 1.7 更新 hash/zip、独立版本与制品校验，排除安装产物并提升实际受影响 skill 版本。
  - 版本证据：全部24个skill因TS updater/运行时分发改变提升到至少HEAD+1；ChangePlan试点
    已从37提升38，本轮不重复提升，其余23个各加1。hash检查、24真实zip/manifest版本和1174文件
    与pending逐字节对照通过；强制暂存安装产物的hash/zip/baseline与正式symlink拒绝测试通过。
- [x] 1.8 更新根稳定命令、Gate impact/生成前置和 CI 准备，使验证消费可信的分发内容。
  - 证据：根命令与精确配置映射改为TS，TaskGraph所选项目launcher使用TS；updater consumer声明
    生成provider，激活闭包涵盖package provider，release batch排除有provider者；联合运行时helper
    与双向领域/updater生成输入已纳impact。test:check 45节点、project-config 5节点通过；8个维护help
    各自独立报告，环境29节点通过，不共享累计超时。CI现有
    Node24.18/pnpm11.7/Bun1.4.2及frozen安装满足准备，无需改变engine、权限或release snapshot。
- [x] 1.9 同步仓库模型、工具链、skill/help、updater 和局部契约，维护必要 Decision、Case 与索引。
  - 根切面：README/仓库模型/工具链/编码规范已同步当前TS、独立安装、宿主复用与恢复契约；
    已建立并核对对齐261020-distribute-editable-typescript-runtimes，修订并归档单文件分发
    前序，严格Decision check通过。5个既有Gate/TaskGraph launcher Case已更新，无新增测试ID；
    Case索引已统一同步，1283个最小原生实体的引用与覆盖检查通过。AI-ready文档优化和编码规范
    优化由独立子代理完成，24个skill结构/内部链接检查通过。

## Verification

- [x] 2.1 在干净目录解包真实 skill，按固定 pnpm frozen 安装运行；锁文件不变，
  修改包内业务 TS 后无需构建即可观察变化。
  - 证据：真实zip在确认无祖先node_modules的隔离目录完成9领域及知识型updater安装，锁字节不变；
    修改ChangePlan业务TS后下次CLI直接显示标记，无构建，验证后还原。
- [x] 2.2 验证依赖不可解析/不兼容、manifest-lock 不一致与安装失败的诊断和恢复指引；
  普通 import 无 CLI、文件/网络副作用，启动和检查不隐式安装。
  - 证据：通用6节点及updater21节点覆盖缺包、可解析但API不兼容、frozen锁失配失败与显式恢复；
    真实zip公开import经stdout/exitCode、进程/网络拦截和文件树对照证明无隐式副作用。
- [x] 2.3 验证宿主兼容依赖与锁文件版本不同、本地依赖目录缺失时仍可运行；
  两份独立安装使用不同依赖版本，重装互不改写。
  - 证据：宿主mdast2.0.3与锁2.1.0、无本地依赖目录仍可运行；valibot1.4.2/1.5.0两独立安装
    与重装互不改写通过，未新增版本/来源门禁。
- [x] 2.4 验证 TS CLI 的真实 argv、输出/退出状态、公开导入和独立消费者类型检查，
  覆盖资源、多入口、调用方路径及 native/optional 能力。
  - 证据：9领域Node24.18入口、全部公开声明的干净独立strict类型消费、TaskGraph类与隐藏内部边界、
    Node22.22.2分发/native、MCPShell双入口/YAML/preview、LJ SQL/SQLite通过；函数/类引用未重建。
- [x] 2.5 验证已有安装更新、依赖重装和失败重试，文件覆盖/保留符合 updater 契约；
  核对知识型 skill 指令使用与 TS updater 各自的前置说明。
  - 证据：`bun run test:skill-updater` 21 节点通过（5.11 秒），涵盖真实 Node TS 自覆盖与下一进程
    使用新代码、缺依赖后的显式 frozen 安装恢复且锁不变、实际不兼容 API 的加载诊断、无副作用导入、
    外部 importer 下的默认目标、普通 copy 失败回滚/重试以及本地文件保留。回滚不承诺 kill/crash 恢复。
  - 历史兼容一次性验收：从实施开始时 `419d04ac` 的已分发 MJS updater 复制到临时旧安装，
    经真实 Node/mock release 安装当前完整 TS zip 成功，旧 MJS 和定制文件保留；该历史制品未提交。
    长期回归临时构建一个自包含 MJS 入口（每次 1 次 bundle），只证明入口格式与不变 zip 协议，
    不依赖 Git 历史、不声称冻结历史实现；独立安装/宿主版本矩阵复用 Change Plan 试点。
- [x] 2.6 核对正式制品、Git 忽略、生成漂移和版本/hash；验证按需配置及纯 TS 运行内容，
  强制暂存安装产物仍不能发布，Case/index 引用与覆盖一致。
  - 证据：24包无node_modules/store/cache/安装链接或旧自有JS/map，正式资源与声明齐全；
    全量生成check、实际Git ignore与强制stage过滤测试通过。1283实体Case覆盖与当前索引检查通过。
- [x] 2.7 运行受影响的 `test:*`、`check:*`、`bun run check` 和 release Gate，
  对照成本预算，说明新增 smoke 的独有证据及未覆盖的平台/网络边界。
  - 证据：`bun run check` 65 passed、3发布专用项不适用，90.3秒；
    `bun run check --tag release --cold` 68/68 passed，0 failed/unavailable，90.1秒；
    包含类型、lint、格式、函数/文件指标、链接、Case覆盖、全部受影响测试/生成检查、版本授权与真实打包。
    测试批次强制重跑，未复用既有批次证明；通用smoke热缓存9.24秒、完整Change Plan矩阵13.19秒，
    符合隔离热缓存15秒预算，发布门禁并发分发Check14.3秒。
    Windows、真实远端服务与未配置的MCPShell/OpenSSH可选集成不在本次已执行证据内。
