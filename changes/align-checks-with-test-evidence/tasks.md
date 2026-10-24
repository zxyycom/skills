# Tasks

按 Readiness → 各子切面实施及目标验证 → 全局 Verification 推进；勾选声明已完成实质工作及所列验收，证据记录到本文件或 findings。

## Readiness

- [ ] 0.1 回读当前源码与 owner，确认审计基线之后 image/video、Windows 和其他相关变更；补齐最终受影响入口、基线、文件所有权与 findings 处置。验收：既有 changes 无同一 Outcome，当前改动／index 无关内容已隔离，未决项有明确验证方法。
- [ ] 0.2 核对全部 RC1–RC7 的实际调用／顶层加载／TypeScript program 与生成消费，定下迁移或原位补齐方案；单列 lint、密钥容量、竞争 seam、leaf 身份四项待核。验收：每组列最终 Check、输入、provider 和精确重跑入口，不用 sourceFiles 候选替代闭包。
- [ ] 0.3 为迁移、去重、拆合、下沉和名称收窄列保留最小入口及 Case 后继，分配并行文件所有权。验收：共同十对、双域 adapter、真实分发／Git／锁／worker 与生产预算均有明确归宿；不固定 Check 数。

## Implementation

- [ ] 1.1 闭合七组八项 Check 接入缺口，按实际结构同步 Definition／订阅／输入版本／fixture。目标验证：直接入口与 `test:check`，覆盖生成物单独变化、provider 带入及不通过时 consumer 不执行，typecheck 不连带扩大 format／quick。
- [ ] 1.2 归位共同事务／reader／verification／双域生成 worker 责任，去掉十份重复注册，保留两域真实 adapter 与其他非重复协议。目标验证：共同和两域精确入口，核实际注册无漏／重、故障与 bytes/mode 观察连续，并更新对应 findings。
- [ ] 1.3 按实际独立责任调整 Check 显示名、必要拆合和聚合入口，校准 A–F 的过强／过窄测试名与 Case。目标验证：catalog／Definition／manifest接线与各受影响入口，不以名称替代缺失的必要证据。
- [ ] 1.4 收窄 gate-tests、recordOperationInputs、domainRuntimeInputs 及实际消费者能力。目标验证：相关／无关字节、leaf 删除／存在性、删除／rename、ignored、共享 flag／provider 传播及起止漂移；不能证明的输入保持保守并记录，不新增依赖图框架。
- [ ] 1.5 修正 A 切面与 Gate 已有建议：独立 format 范围、CAS 证据边界、密钥项目消费、环境零安装观察、性能 CLI native durations、catalog import 解析。目标验证：目标 Gate／环境测试及针对性错误输入，慢样本在安全总墙钟下产生具体 P90/mean 与退出判断，无真实 sleep。
- [ ] 1.6 完成 DR／共同 runtime 证据整改：正确 ID 删除、日期独立预期、分页／过滤责任、复合意图分离、工作量探针、双向锁屏障及 umask 子进程超时。目标验证：各精确原生入口；必要分页／fresh／CAS／旧新快照隔离和稳定工作量责任仍成立。
- [ ] 1.7 完成 IR 证据整改：content 独立预览、恢复完整 bytes、formalDrift 当前语义、排序与过滤区分数据、stage／resource／trace／事务外层观察及相应名称／复合意图。目标验证：目标入口、selected candidate/index 拒绝与未选正文不阻断；不改产品全量读取语义。
- [ ] 1.8 完成 TG／Test Evidence 证据整改：声明私有名单解耦、serializer 乱序、独立意图拆分、usage 下沉／缩规模、准确名称／cache inode 承诺。目标验证：类型 consumer、公开 API／schema／生成头、代表 Node CLI、原生入口选择与 Case 后继。
- [ ] 1.9 完成 E 切面证据整改：symlink 阶段命中或准确收窄、图片健康凭据／精确诊断／零访问、SSH 零调用、binary/empty 独立 hash、TOML 原 bytes、Novel BOM 故障命中、CP/new-id 名称。目标验证：对应离线入口与失败注入，manual-only 真实服务 smoke 不混为 Gate 证据。
- [ ] 1.10 完成 F 切面／既有建议：跨行独立 fixture、实际取消阶段、既存 member bytes drift、binary prefix／失败尾观察、轻量路径/mock Git、updater 类型写法解耦与有更新 `--check` 只读、publisher zip 上传失败停止。目标验证：对应共享／updater／发布本地替身入口；mode 只有保留双向完整保护后才合并。
- [ ] 1.11 完成 fixture 与参与方生命周期：Test Evidence 临时目录回收、CP Git 环境隔离、MCPShell initializer 去无关建仓、TG child 和 LJ child/server、IR/DR 屏障异常收束。目标验证：单独／组合／必要重复运行及注入失败后 child 退出、目录回收；不宣称已复现的竞态概率。
- [ ] 1.12 隔离健康结构＋仅坏链接及坏结构场景，把 orphan `scripts/validate.test.ts` 接入合适既有 `test:*` 与 Case，不新增重复 Gate。目标验证：删除 skip 接线时目标断言失败，合法结构负例不被无关配置错误掩盖，聚合 runner 实际发现。
- [ ] 1.13 随各切面同步 Case，并完成全局实体快照／index 整合、生成物与独立版本。目标验证：`bun run sync:test-evidence-catalog`、`bun run check:test-evidence-catalog` 与受影响 `sync:*`／`check:*`；每个保留最小原生入口均有准确 Case，不登记容器。
- [ ] 1.14 更新实际受影响稳定 owner，核长期决策门槛；最终使用 AI-Ready Docs 优化消费路径，按编码规范优化本次实现及直接边界。验收：catalog事实／命令／输入／CI／生成边界一致，无临时审计路径进入长期文档，无无关重写或仅转发抽象。

## Verification

- [ ] 2.1 对每个实施子切面完成独立正确性复核与必要修正，逐项闭合 findings 的采用／收窄／不实施理由、保留后继及运行证据。验收：目标错误能被外层断言区分；撤回项未被误实施，未证明项不冒充已证明。
- [ ] 2.2 对迁移、拆合、下沉、去重入口取得 runner 实际发现／选择／单独报告及邻近回归证据，运行 `bun run test:check` 和 Test Evidence 结构／引用／覆盖检查。验收：完整当前 Definition、命令、输入、provider、Case 一致，无意外 skip／孤儿／重复。
- [ ] 2.3 最终文档按代表性 AI 阅读任务检查其目标、owner、依赖、边界与操作可恢复性；代码按编码规范检查数据流、失败／资源边界与抽象责任，修正后重跑受影响验证。验收：分别记录语义复核与机械检查，不以格式通过替代实际可用性。
- [ ] 2.4 运行 `bun run check` 与 `bun run check:changed`，记录 scope、实际执行／复用、性能政策、原生质量与 receipt 发布结果。验收：quick 原 eligible 和预算不放宽，changed 完整变更责任与精确无漂移成功事务成立；失败先解释修复，不能用重试通过覆盖首次失败。
- [ ] 2.5 核对 pending snapshot／版本基线并运行 Linux `bun run check --tag release --cold`（必要时显式事件基线），保存同快照版本授权与全部打包结果。验收：当前新增 image/video 检查仍在全量范围，全部普通检查真实执行，release 不用 receipt；未暂存内容不冒称已进入 zip。
- [ ] 2.6 核对最终相关 revision 的远端 workflow，取得 `package` 与 `video-windows` 实际成功、同 tested revision 和同次 skills artifact 的视频 zip 验收证据；按 tooling 核既有远端必需检查／阻断证据，缺访问或配置权限时报告明确外部阻塞，不擅写配置。验收：两门禁都实际执行、不路径跳过，发布依赖未弱化，不用 Linux 本地结果替代 Windows。
- [ ] 2.7 做最终范围和交付核对：所有成功标准有证据，findings无漏项，稳定知识归 owner，无关工作未 stage，当前可提交改动按 git-commit-organizer 整理。验收：实际运行、未覆盖平台／外部状态和风险均可独立读取；用户授权内正常提交及结项路径清楚。

完成以上实质任务后，由整合者保存最终全勾 Plan 的 Git 快照，运行 `change-plan finalize --preflight`、`finalize` 与 `list` 确认退出；这些是完成后的结项动作，不是全勾前置任务。提交可触发已授权 hook 自动推送，不手工 push。

## 基线验证记录

- 实施前 `bun run check:changed`：64 项 base 实际执行，62 通过、2 失败（112.6 秒）；尚未修改源码。typecheck 失败为当前依赖目录缺 manifest 已声明的 `@types/bun`；video 分发 fixture 检测到宿主 `/tmp/node_modules`，隔离前提不成立。后续先恢复锁定本地依赖、使用无 ambient node_modules 的临时目录，再复核，不修改产品语义或放宽测试。
- `node scripts/environment.js gate` 在固定 Bun 1.4.2 下通过。当前 HEAD 的远端 `package`、`video-windows`、`publish` 均成功；不作为后续改动已验证的证据。GitHub 查询显示 main 无 branch protection、仓库 rulesets 为空；本任务仅核对并报告，不擅自配置远端保护。
