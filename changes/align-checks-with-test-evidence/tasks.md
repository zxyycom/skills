# Tasks

按 Readiness → 各子切面实施及目标验证 → 全局 Verification 推进；勾选声明已完成实质工作及所列验收，证据记录到本文件或 findings。

## Readiness

- [x] 0.1 回读当前源码与 owner，确认审计基线之后 image/video、Windows 和其他相关变更；补齐最终受影响入口、基线、文件所有权与 findings 处置。验收：既有 changes 无同一 Outcome，当前改动／index 无关内容已隔离，未决项有明确验证方法。
- [x] 0.2 核对全部 RC1–RC7 的实际调用／顶层加载／TypeScript program 与生成消费，定下迁移或原位补齐方案；分别定下 lint、密钥容量、竞争 seam、leaf 身份四项边界。验收：每组列最终 Check、输入、provider 和精确重跑入口，不用 sourceFiles 候选替代闭包。
- [x] 0.3 为迁移、去重、拆合、下沉和名称收窄列保留最小入口及 Case 后继，分配并行文件所有权。验收：共同十对、双域 adapter、真实分发／Git／锁／worker 与生产预算均有明确归宿；不固定 Check 数。

## Implementation

- [x] 1.1 闭合七组八项 Check 接入缺口，按实际结构同步 Definition／订阅／输入版本／fixture。目标验证：直接入口与 `test:check`，覆盖生成物单独变化、provider 带入及不通过时 consumer 不执行，typecheck 不连带扩大 format／quick。
- [x] 1.2 归位共同事务／reader／verification／双域生成 worker 责任，去掉十份重复注册，保留两域真实 adapter 与其他非重复协议。目标验证：共同和两域精确入口，核实际注册无漏／重、故障与 bytes/mode 观察连续，并更新对应 findings。
- [x] 1.3 按实际独立责任调整 Check 显示名、必要拆合和聚合入口，校准 A–F 的过强／过窄测试名与 Case。目标验证：catalog／Definition／manifest接线与各受影响入口，不以名称替代缺失的必要证据。
- [x] 1.4 收窄 gate-tests、recordOperationInputs、domainRuntimeInputs 及实际消费者能力。目标验证：相关／无关字节、leaf 删除／存在性、删除／rename、ignored、共享 flag／provider 传播及起止漂移；不能证明的输入保持保守并记录，不新增依赖图框架。
- [x] 1.5 修正 A 切面与 Gate 已有建议：独立 format 范围、CAS 证据边界、密钥项目消费、环境零安装观察、性能 CLI native durations、catalog import 解析。目标验证：目标 Gate／环境测试及针对性错误输入，慢样本在安全总墙钟下产生具体 P90/mean 与退出判断，无真实 sleep。
- [x] 1.6 完成 DR／共同 runtime 证据整改：正确 ID 删除、日期独立预期、分页／过滤责任、复合意图分离、工作量探针、双向锁屏障及 umask 子进程超时。目标验证：各精确原生入口；必要分页／fresh／CAS／旧新快照隔离和稳定工作量责任仍成立。
- [x] 1.7 完成 IR 证据整改：content 独立预览、恢复完整 bytes、formalDrift 当前语义、排序与过滤区分数据、stage／resource／trace／事务外层观察及相应名称／复合意图。目标验证：目标入口、selected candidate/index 拒绝与未选正文不阻断；不改产品全量读取语义。
- [x] 1.8 完成 TG／Test Evidence 证据整改：声明私有名单解耦、serializer 乱序、独立意图拆分、usage 下沉／缩规模、准确名称／cache inode 承诺。目标验证：类型 consumer、公开 API／schema／生成头、代表 Node CLI、原生入口选择与 Case 后继。
- [x] 1.9 完成 E 切面证据整改：symlink 阶段命中或准确收窄、图片健康凭据／精确诊断／零访问、SSH 零调用、binary/empty 独立 hash、TOML 原 bytes、Novel BOM 故障命中、CP/new-id 名称。目标验证：对应离线入口与失败注入，manual-only 真实服务 smoke 不混为 Gate 证据。
- [x] 1.10 完成 F 切面／既有建议：跨行独立 fixture、实际取消阶段、既存 member bytes drift、binary prefix／失败尾观察、轻量路径/mock Git、updater 类型写法解耦与有更新 `--check` 只读、publisher zip 上传失败停止。目标验证：对应共享／updater／发布本地替身入口；mode 只有保留双向完整保护后才合并。
- [x] 1.11 完成 fixture 与参与方生命周期：Test Evidence 临时目录回收、CP Git 环境隔离、MCPShell initializer 去无关建仓、TG child 和 LJ child/server、IR/DR 屏障异常收束。目标验证：单独／组合／必要重复运行及注入失败后 child 退出、目录回收；不宣称已复现的竞态概率。
- [x] 1.12 隔离健康结构＋仅坏链接及坏结构场景，把 orphan `scripts/validate.test.ts` 接入合适既有 `test:*` 与 Case，不新增重复 Gate。目标验证：删除 skip 接线时目标断言失败，合法结构负例不被无关配置错误掩盖，聚合 runner 实际发现。
- [x] 1.13 随各切面同步 Case，并完成全局实体快照／index 整合、生成物与独立版本。目标验证：`bun run sync:test-evidence-catalog`、`bun run check:test-evidence-catalog` 与受影响 `sync:*`／`check:*`；每个保留最小原生入口均有准确 Case，不登记容器。
- [x] 1.14 更新实际受影响稳定 owner，核长期决策门槛；最终使用 AI-Ready Docs 优化消费路径，按编码规范优化本次实现及直接边界。验收：catalog事实／命令／输入／CI／生成边界一致，无临时审计路径进入长期文档，无无关重写或仅转发抽象。

## Verification

- [x] 2.1 对每个实施子切面完成独立正确性复核与必要修正，逐项闭合 findings 的采用／收窄／不实施理由、保留后继及运行证据。验收：目标错误能被外层断言区分；撤回项未被误实施，未证明项不冒充已证明。
- [x] 2.2 对迁移、拆合、下沉、去重入口取得 runner 实际发现／选择／单独报告及邻近回归证据，运行 `bun run test:check` 和 Test Evidence 结构／引用／覆盖检查。验收：完整当前 Definition、命令、输入、provider、Case 一致，无意外 skip／孤儿／重复。
- [x] 2.3 最终文档按代表性 AI 阅读任务检查其目标、owner、依赖、边界与操作可恢复性；代码按编码规范检查数据流、失败／资源边界与抽象责任，修正后重跑受影响验证。验收：分别记录语义复核与机械检查，不以格式通过替代实际可用性。
- [x] 2.4 运行 `bun run check` 与 `bun run check:changed`，记录 scope、实际执行／复用、性能政策、原生质量与 receipt 发布结果。验收：quick 原 eligible 和预算不放宽，changed 完整变更责任与精确无漂移成功事务成立；失败先解释修复，不能用重试通过覆盖首次失败。
- [x] 2.5 核对 pending snapshot／版本基线并运行 Linux `bun run check --tag release --cold`（必要时显式事件基线），保存同快照版本授权与全部打包结果。验收：当前新增 image/video 检查仍在全量范围，全部普通检查真实执行，release 不用 receipt；未暂存内容不冒称已进入 zip。
- [ ] 2.6 核对最终相关 revision 的远端 workflow，取得 `package` 与 `video-windows` 实际成功、同 tested revision 和同次 skills artifact 的视频 zip 验收证据；按 tooling 核既有远端必需检查／阻断证据，缺访问或配置权限时报告明确外部阻塞，不擅写配置。验收：两门禁都实际执行、不路径跳过，发布依赖未弱化，不用 Linux 本地结果替代 Windows。
- [ ] 2.7 做最终范围和交付核对：所有成功标准有证据，findings无漏项，稳定知识归 owner，无关工作未 stage，当前可提交改动按 git-commit-organizer 整理。验收：实际运行、未覆盖平台／外部状态和风险均可独立读取；用户授权内正常提交及结项路径清楚。

完成以上实质任务后，由整合者保存最终全勾 Plan 的 Git 快照，运行 `change-plan finalize --preflight`、`finalize` 与 `list` 确认退出；这些是完成后的结项动作，不是全勾前置任务。提交可触发已授权 hook 自动推送，不手工 push。

## 阶段完成证据与剩余工作

以上勾选依据实施者的精确目标运行和独立静态复核，不表示本文编辑者重跑，也不表示最终工作树整体已通过。完整处置与全部 145 个原逐节点来源键的回查路由见 [findings](findings.md)。

| 已勾任务 | 证据与完成范围 |
| --- | --- |
| 0.2、0.3 | [Gate 交接](gate-handoff.md) 已列 RC1–RC7 consumer/输入/provider/命令及保守 lint/leaf 方案；各领域 handoff 已列共同十对、两域 adapter、迁移后继与保留规模，正式 Case 写入另由 1.13 验收。 |
| 1.6、1.7 | [记录交接](records-tests-handoff.md)：共同/两域目标叶子、Node/umask、锁屏障、分页/UTC/恢复/漂移等通过；最后 index 9、identity 8 显式节点复跑通过。任意直接多文件组合的既有 fixture 生命周期失败未被冒充通过。 |
| 1.8 | [图/账本交接](graph-evidence-tests-handoff.md)：TG 包 96 Bun+3 Node、TE 包 44 通过；最终 recovery 精确选择 1 pass。首次并发超时保留，未放宽预算。 |
| 1.9 | [Skill 工具交接](skill-tools-handoff.md)：LJ request 68、CP/MCPShell 78、Novel 37 及五轮受控交错通过；首次 Novel 超时和 LJ 故障现场如实保留。 |
| 1.10 | [仓库/共享交接](repository-tests-handoff.md)：环境23、Index Runtime86、search23、updater19（安装恢复 filtered）、Git目标28、publisher7 通过；保留预算/安装/深链节点未在该批选择中运行。 |
| 2.1 | 三份独立 review 均无剩余阻断；[Gate 定向复核](review-gate-repository.md) 确认 G1–G3 修后闭合。复核是静态证据，不替代最终 runner/Gate。 |

### 本轮完成核对

| 已勾任务 | 闭合依据 |
| --- | --- |
| 0.1 | [最终范围复核](review-final-commit-scope.md)：326路径、本方163 CaseID、三个混写单行/他方11 Case排除，主index/隔离/tree一致；旧审计与相关Change的Outcome边界已在readiness恢复。 |
| 1.1–1.5 | [Gate交接](gate-handoff.md)的RC1–RC7、输入/前置、保守裁剪、政策/CLI/AST回归，加最新隔离test:check **107 pass/1预期Windows skip**和全部base通过。Case接线由1680实体引用/覆盖验证，未用sourceFiles自动推导。 |
| 1.11 | 领域handoff的临时根回收、CP hostile Git、双域锁finally、TG child及LJ故障超时/退出证据，加当前共同/领域聚合通过。LJ目标故障确实命中；不扩称已穷尽所有child失败或复现旧正常路径竞态。 |
| 1.12 | 仓库handoff的健康/坏链接/坏结构独立节点、Case接入，及初次隔离的validator去skip反事实失败/恢复重跑通过。 |
| 1.13 | Case owner已同步本方变更；公开stage-index选择163 ID，最新隔离**1680实体**引用/覆盖通过；统一生成provider通过。cached无skill、runtime源码或build adapter改动，未产生本方版本承载变化，相关sync/version调整不适用。 |
| 1.14、2.3 | [代码优化](code-optimization.md)的实际局部改动/目标复验与后续无需新抽象的定向复核；[文档优化](docs-optimization.md)的AI阅读及限定机械检查。长期owner/决策门槛已闭合，没有新Decision或无关重写。 |
| 2.2 | 最终隔离test:check **108 total/107 pass/1预期skip/0 fail**、Case1680检查及全base成功，迁移/拆分/新节点有真实runner与账本双重证据。 |
| 2.4 | 最新changed全base66通过、58 receipt发布；同tree重复changed仅8项实际通过/58复用、无回退或未闭合；quick10 eligible中5实际通过/5复用，预算通过且不发布。首次失败、冷quick和最终性能均见[验证记录](verification.md)。 |
| 2.5 | 同tree冷release **69/69 Check通过**、69 execute/0 reuse，基线a661d059…、versionIssueCount0；prepare→version授权→pack同快照完成，全部zip实际生成，见[验证记录](verification.md)。 |

当前实施、本地变更验收与Linux冷release已完成，仅剩2.6最终revision远端/Windows与保护状态核对、2.7最终交付。上述勾选以实现/索引受测tree `0f06721a20864eb830c7da49a729dceaf2912ff0` 为依据，本轮文档状态更新另行机械检查，不能冒称已在该tree中受测。

混合工作区1691实体只作Case维护证据；交付依据是排除他方工作后的隔离1680。公开stage-index的选择范围与精确快照见最终范围复核，不复制临时操作过程。

## 基线验证记录

- 实施前 `bun run check:changed`：64 项 base 实际执行，62 通过、2 失败（112.6 秒）；尚未修改源码。typecheck 失败为当前依赖目录缺 manifest 已声明的 `@types/bun`；video 分发 fixture 检测到宿主 `/tmp/node_modules`，隔离前提不成立。后续先恢复锁定本地依赖、使用无 ambient node_modules 的临时目录，再复核，不修改产品语义或放宽测试。
- `node scripts/environment.js gate` 在固定 Bun 1.4.2 下通过。当前 HEAD 的远端 `package`、`video-windows`、`publish` 均成功；不作为后续改动已验证的证据。GitHub 查询显示 main 无 branch protection、仓库 rulesets 为空；本任务仅核对并报告，不擅自配置远端保护。
