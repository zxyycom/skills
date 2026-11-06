# Rust 候选平台与验证计划

本文件是本 Change 的 0.2 / 0.4 工程方案，不是现行生产契约或通过证明。命令和结果清单以 0.1 为覆盖基准，架构与具体协议以 0.3 为准；清单变化时逐行对账本矩阵。旧 Rust 查询实验的测试、性能和豁免均不自动继承。本轮只在私有 workspace 操作，不触碰真实记录、用户安装、生产入口、发布或远端资产。

## 平台冻结与证明边界

工程冻结候选 target 为 `x86_64-pc-windows-msvc` 和 `x86_64-unknown-linux-gnu`，并以 GitHub Actions 原生 `windows-2022` x64 / NTFS 和 `ubuntu-22.04` x64 / glibc 2.35 的工作区文件系统为本 Change 验收矩阵；测试运行时记录 OS build、架构、实际 glibc、kernel、文件系统类型、Git 和工具链，Windows 检查测试目录确为 NTFS。Linux 按实际工作区文件系统记录和限定结论，不预断 hosted runner 的底层文件系统是 ext4。Windows 使用 MSVC/UCRT；记录二进制实际运行库依赖，安装时不得假设用户安装 Visual Studio。两个 job 必须各自原生构建和运行；ARM、32 位、musl、macOS、WSL 及交叉编译不代替这两项。冻结是实施决定而非通过记录；完成时只声明实际通过的组合。

更低 OS、kernel、glibc 及其他文件系统属于未来兼容候选，不是本次额外验收门槛，也不因工具链最低支持版本推断已受支持；可用工具链、API 与 ELF/PE 依赖核对实际二进制最低需求，但未经相应环境运行不能保证。网络盘、特殊安全策略亦不自动承诺。具体锁定工具链、依赖与构建输入由 0.5 定稿并记录。

| 平台 | 必须直接证明的安全观察 | 限制 |
| --- | --- | --- |
| Linux/实际验收文件系统 | 非法路径、组件 symlink、最终项替换及身份变化 fail closed；记录实际打开句柄身份和 mode；真实 Git index 锁、CAS/pending 变化、rename 与恢复；故障后回读目录和 index | 不将权限位等同 Windows ACL；非合作写者不能因检测而声称被隔离，崩溃断电持久性不由普通失败注入证明 |
| Windows/NTFS 原生 | 相同路径逃逸和身份替换，reparse point/junction、大小写别名、盘符/UNC/绝对路径与保留名；打开句柄的文件身份、共享冲突、替换/rename 与 cleanup；Git for Windows 真实 index/pending 和锁 | symlink 创建权限不足要显式报告，junction 测试不能冒充 symlink；不把 Unix mode/inode 或 POSIX rename 假设为 Windows 保证。ACL 仅证明实际配置和观察，不声称抵抗管理员或全部 ACL |

两平台均以外部哨兵文件、原始字节、句柄身份、Git index tree/status/未关联 pending 内容和退出结果为观察；注入点若只证明测试替身，不得声称真实平台竞态。用同步屏障而非 sleep 制造可复现竞争，分别证明检测与提交点结果，不把非合作写者的检测当互斥锁。无法创建平台能力时显式失败或记录受限项，不能静默 skip 后称通过。

## 共用测试规则与责任

以各领域 CLI 操作契约、`tools/record-operations/model.md`、`tools/index-runtime/README.md` 为期望来源，0.1 的逐命令参数和结果清单为追踪表；实现、旧测试和旧 CLI 本身不是唯一 oracle。预先手工定义输入树和预期 JSON 字段/类型/缺省、顺序、诊断、状态及前后字节；按 0.3 冻结的 schema/错误码修订。仅对已有公开成功 trace JSON 按各域既有完整结构比较；其他 JSON 用手工期望验证语义，TS 差分仅辅助定位，不能以共同错误通过。规则矩阵尽量在领域层执行，CLI 独立证明 argv、JSON 单结果、stderr、退出码，真实进程验证制品启动和通道；重型真实 Git 只保留降层不能观察的语义。下面是候选组，实施时每个最小节点依据有效性、保护价值和形态成本再准入；结果未实施、未通过。

固定原始 fixture 树纳入对应测试 owner，不提交 `.git`；每个会改 index/worktree/ref/config/lock 的 case 拷入自己的临时目录，以真实 `git init`、固定本地配置、add、基线 commit 初始化。只读可复用不可变模板，不共享可变仓库；固定时间、身份及顺序，跨平台规范换行，并显式构造 Unicode、非法 UTF-8 与必要文件系统边界。Git 状态通过独立 Git 命令和字节回读观察，断言失败、清理及子进程退出均向 runner 传播。拒绝将真实记录目录作为 fixture。

## 待实施矩阵（两域分别执行，DR 专有项另列）

| ID / 责任与现实风险 | 代表输入、独立预期及观察 | 最小充分边界 |
| --- | --- | --- |
| Q1 `list/show/candidates/show-candidate` | 空、多个状态、过滤/分页、缺失/损坏；手写期望条目、范围/来源和诊断；合法空与失败不同 | 领域查询 + 两域各一 CLI 贯通 |
| Q2 `search` | 标题/正文、多条件、边界匹配、Unicode、无匹配；逐条 ID、位置、preview（含 column）、计数、顺序预期；损坏来源报告完整性 | 领域查询，CLI 关键选项 |
| Q3 `trace` | 各域图含分支、环、缺失引用、预算耗尽、对齐/blocked；手写根、edges、frontier、coverage、顺序和完整各域原有 JSON；预期非另一实现序列化 | 领域图 + 两域真实 JSON CLI |
| Q4 `check/sync-index` | 合法/损坏源、重复身份、缺文件、过期 index；分别断言诊断、只读不变、选择性/全量写集、索引内容及未选择项不变；fresh 与写后回读独立采集 | 私有文件系统；依赖 pending 的情况真实 Git |
| M1 `new/publish` | 合法、重复、非法字段、缺引用、多对象与冲突；核对候选/正式文件、ID、index、返回结果和全部失败前后状态；多对象失败及部分恢复以 owner 定义提交点为准 | 私有 workspace，涉及 pending 用真实 Git |
| M2 DR `evolve/archive/reactivate/mark-aligned` | 各合法/非法生命周期与前后关系；手写状态和关联变化，拒绝非法转移且不写入 | 领域规则 + 必要真实文件事务 |
| M3 `set-relations/rename/discard` | 双域关系替换、删除候选/正式、重命名及冲突、引用检查；逐项核对目标与非目标字节、索引、诊断和恢复 | 私有文件与真实 Git 边界 |
| G1 `stage` | 基线提交后构造未相关 pending、worktree 与 index 不同、目标变化；独立比较 `git diff --cached`、blob 和 worktree，所选写集正确且其他 pending 原样；冲突不覆盖 | 真实 Git 子进程，两平台 |
| S1 安全/编码 | 越界、符号链接、路径替换、大小写、无效 UTF-8、权限或共享冲突；拒绝且哨兵及非目标字节不变；格式/排序与 UTF-16 preview 指定值 | 平台原生文件系统与真实进程 |
| F1 阶段与恢复 | 各操作的预检、执行准备、提交前/后、postverify、cleanup/unlock 注入；逐阶段分别核对错误类别、已提交事实、可恢复信息、残留与重新运行，不把提交后失败说成回滚 | 受控故障注入 + 独立回读，关键路径真实 FS/Git |
| C1 并发 | 合作锁争用、pending/源在预检后变化、CAS 竞争与提交前身份替换；用屏障令对手真实进程修改，断言胜负、拒绝、无丢失与锁释放 | 真实多进程 + 私有 Git；非合作编辑只按观察报告 |
| P1 启动/协议 | 每域每命令的成功和可代表领域失败，解析 help/非法 argv、stdout 单 JSON、stderr 分流、非零状态；模式与字段逐项对应 0.1/0.3 | 源码入口参数矩阵 + 各域构建产物真实进程 smoke |

每组按 0.1 清单展开命令、选项、领域特例和 Case/节点映射；无法建立独立预期、权限或冻结验收环境的项标未决，不以表格存在当覆盖。特别对快照复用做可观察的阶段测试：阶段内重复读取不额外改变语义，fresh 与 postverify 注入外部变化后必须看到新状态；性能/内部计数辅助，不以 mock 调用次数取代结果。

## Cargo 实体、Gate 与 CI 接线

新增明确的 Rust 稳定聚合入口（例如 `test:record-rust`）和独立 `code` 能力组（例如 `record-rust`），订阅 Cargo 构建/测试、格式及 lint，声明源、测试、fixture、Cargo manifest/lock 与构建输入闭包；按实际 owner 修订名字。Gate 的 quick 六项不调用 Rust，也不要求 cargo。显式 scope 追加 quick 和项目现有 code 质量项，另运行 Rust 专属 `cargo fmt --check`、锁定依赖的 `cargo clippy`、`cargo test --locked`；不能把 TS lint/typecheck 作为 Rust 质量证据。 当前 `native.ts` 的维护、产品、测试代码投影仅包含 JS/TS；已安装 scc 4.0.0 声明支持 Rust，vibe-check 0.0.5 的 function analyzer 也注册 `.rs` RustReader，但不能据此推断项目已采集。将 Rust 源与测试按角色加入文件投影和领域范围，以可控 Rust 样本和实际 Gate 结果核对 file/function metrics 均真正发现并处理目标；意外空集或解析漏项阻断。继续执行受影响 TS 的既有质量检查，但不以其通过冒充 Rust 检查。Rust 实现遵守编码规范的共同职责、边界、类型、失败与验证要求，TS 专属语法规则不机械套用；最终按实际 owner 同步规范。CI full 是否纳入此组由接入变更明确，验证 workflow 不能触发发布。

现有 `scripts/test-evidence/snapshot/snapshot-commands.ts` 仅识别 `bun test` / `node --test`，类型也仅有 bun/node。须扩展项目采集器直接理解受限 Cargo 命令与 workspace/target，解析 Cargo metadata 和各实际测试二进制的原生 `--list`（包含 ignored），以 package + target kind/name + 完整测试名形成可稳定独立选择的实体和 locator；区分同名节点、unit/integration/doc，空集合、解析失败、重复、不可选择或未枚举 target 均 fail closed。若 doc test 无法稳定单选和单独报告，明确禁止将其当作账本实体并改用可选择的原生 integration 节点，不能以单个 Node wrapper 伪装每个 Cargo 节点。采集不得只采运行结果或把 test binary/suite 当最小节点；核对选择器实际精确执行单节点且 failures/ignored 可见。

来源 revision 覆盖清单、Cargo.lock、Cargo 配置、源码/测试及条件编译和采集工具链等实际输入；独立计算 expected source，变化及采集中途漂移阻断；针对平台条件测试确保完整集合与平台身份可区分，不以 Linux 集合冒充 Windows。扩展采集器自身测试覆盖发现、同名、漏 target、失败、空与漂移；候选 `delivery/**` 的私有构建、安装与回退测试也由其实际原生 runner 枚举并接入同一项目快照和 Case 覆盖；若不是 Cargo 节点，沿其真实 runner 处理，不改称 Cargo。每个保留节点由项目 Case 的 Contract/Proves 承接，按意图合并而非强迫一对一。运行公开 snapshot、Case 检查、覆盖检查与真实 Cargo 测试；快照引用成立不等于测试通过。此阶段只设计，不写真实 Case/index。

独立候选验证 CI 在相同受测 revision 上运行原生 `ubuntu-22.04` x64 和 `windows-2022` x64，固定工具链与锁定依赖并记录 runner 镜像、Git 版本，运行上述 scope 与完整原生 Cargo 测试及离线交付测试，记录节点、失败、skip、平台/文件系统信息；禁止用路径过滤、空测试、跳过或交叉编译冒充通过。验证同平台构建的资产和安装后的真实运行，并记录版本、命令、日志及 hash。候选 workflow 不调用生产打包或发布、不上传正式 Release，也不成为现有生产 release 的依赖；其他现有 workflow 的触发和副作用独立核对，不能假设新 workflow 隔离意味着 main push 不会触发旧流程。当前只读核查：本机为 Linux/WSL2，未发现原生 Windows shell；仓库 Actions 已启用，账户 API 返回管理和推送权限，self-hosted runner 为零，现有 workflow 仅有视频 Windows job。尚未触发任何 job，也未证明 hosted runner 配额或对应 revision 通过。

## 离线制品与性能

在隔离目录从锁定源 revision、工具链、target、依赖和配置构建每个目标的候选资产；manifest 绑定 schema 版本、产品版本、target、文件名、大小、SHA-256 与来源 revision/build-input 身份。验证目标不匹配、缺失/重复资产、hash/长度错误、路径逃逸、损坏和中途失败时拒绝安装，旧版本与无关文件不变；成功后独立读取并执行安装的精确字节，更新到下一版本，再注入失败验证回退及清理。安装、更新、回退仅在私有目录，二进制不提交 Git。Windows 制品须在 Windows 原生验，不以 Linux 交叉构建代替。

未来 GitHub release 资产/manifest 接线须绑定相同来源和 hash，明确构建输入与现有 `pack:skills` Git pending 快照的关系，避免未版本管理二进制被误当 pending 输入；定义旧入口保留、切换、清理与恢复，但不在本 Change 接通生产或联网安装。离线成功不证明远端分发、签名、线上 updater 或真实用户环境。

性能在固定私有 fixture 的小、中、大规模，用两域代表 `list/search/trace` 与必要写操作比较真实单次新旧进程；记录数据规模和图边数、输入 hash、revision、命令、机器/OS/文件系统、工具链、构建配置、冷暖条件、预热、次数与分布（至少 median/P95）及错误；分别报告进程启动、I/O、构图可观测部分和端到端，不把累积多次进程当单次延迟。无统一加速承诺；旧实验与 CI 一次运行不替代本候选测量。
