# 验证记录

## 验证对象

本轮以可归因的 Git index 为交付对象，在独立验收 worktree 验证；不把含并行领域实现的主工作区当作提交快照。

- 提交前本地门禁受测tree：`0f06721a20864eb830c7da49a729dceaf2912ff0`；主工作区index、隔离worktree与该tree的4863项mode/blob/path完全一致。[最终范围复核](review-final-commit-scope.md)无阻断：326改动路径（325 manifest路径＋选择性index），Case为114修改/47新增/2删除。
- 并行领域源码、生成物、11 个 Case 和混合文件中的明确他方行保留在主工作区，未暂存；Case 索引通过公开 `stage-index` 只接纳本方163个ID（包括两项删除）；working混合索引保持不变。
- 运行时固定 Bun 1.4.2、Node 24.18.0，`TMPDIR=/var/tmp`；完整结果保存在本轮 ignored 验收日志，不作为长期源码提交。

## 初次隔离快照已取得的证据

以下历史结果对应初次tree `33275f8e1b8b36e023ed1cb04e9dd88b8ae2acb0`（159-ID选择），范围复核见`review-commit-scope.md`；后续测试拆分、输入接线和Case更新不在该旧快照中。当前结果另列下节，保留首次通过与失败的真实先后。

1. 隔离快照 `typecheck` 通过；Case 结构、实体引用与完整覆盖通过，共 1677 实体，不含并行会话的 11 个新节点。
2. 完整 `test:check`：104 通过、1 项 Windows 专属 batch 测试在 Linux 跳过，无失败；总时长 61.65 秒。
3. 冷 quick：十项均实际执行，墙钟 12.62 秒、P90 8.05 秒、均值 2.63 秒，原性能门槛通过。
4. 定向反事实：仅在验收 worktree 临时移除仓库 validator 的链接跳过接线，健康结构／坏链接节点如预期因缺失链接失败；原文件字节已恢复，原节点重跑通过。没有改变产品行为。

## 首次完整变更检查及处置

首次 `check:changed` 实际执行 66 项 base：63 通过、3 失败，未发布成功 receipt。失败与输入回退分别处理，不用重试掩盖：

- file-metrics 失败：native-selection 389、profiles 422 code lines 超过原 360 上限。function-metrics 失败：input-ownership 的组合 callback code-density 110 超过原 100 上限。原 owner 按独立责任拆为 native-policy/cli-performance 两个新文件，并把 ownership 的三个意图拆成独立节点；没有新增 helper 或放宽政策。
- Record Operations 权限测试在模块解析前被拒绝：root 为验收 worktree 创建的依赖软链接解析到授权读范围之外，属于验收环境问题。已移除该自建软链接，按现有锁离线安装独立依赖（202 项复用、零下载）；原权限节点复跑 1 pass。产品行为、Node 权限范围及测试断言均未改变。
- 输入回退有两个来源，均不等同额外失败 Check：DR/IR 人工 `run.ts` 未归属领域能力，由原 owner 新增两个精准 test-catalog 能力，仅由真实 catalog 消费者订阅；自建 `node_modules` 软链接导致输入未闭合，则由上述验收环境修复处理。目录已改为真实离线安装目录，最终输入闭合与receipt发布已由下述新tree的完整changed确认。

## 修复后的定向证据

[Gate 交接](gate-handoff.md)记录六个受影响测试文件串行 **27 pass / 0 fail / 0 skip**；原项目 file/function metrics 限定九个改动文件均 **0 finding / 0 blocking finding**。新 run 归属回归确认 incremental、unclassifiedPaths 为空，真实 catalog consumer execute、领域 leaf reuse。[代码优化补充复核](code-optimization.md)已核对拆分责任、局部表达与接线，限定 lint/format/diff-check 通过；未新增 helper。

上述是实施者/复核者的目标证据，不是本记录编辑者独立重跑，也不代替全 Gate。完整 Check/receipt 数仍 69/66/58，quick 原10项与全部质量、性能、权限政策保持不变。

## 提交前精确快照验收

以下由root在当前tree的隔离worktree实际执行；本记录编辑者读取日志/机器结果及root交接，不冒称独立重跑。隔离Case检查为**1680实体**；混合工作区Case维护快照1691包含他方11实体，未进入当前提交范围。

| 入口 | 实际结果 |
| --- | --- |
| typecheck、Case检查 | 均通过；Case结构、引用和完整覆盖1680实体。 |
| test:check | 108 total，**107 pass/1 Windows专属skip/0 fail**，原生duration53795.485312ms；当前完整base中该Check通过。 |
| 完整changed | **66 pass/0 fail/3 release not-applicable**，elapsed99.4s；执行66个实际样本。输入计划execute58/reuse0/fallback0/firstRun58，unclosed entries=[]/total0；publication published=true/receiptCount58。 |
| 同tree重复changed | **8项实际pass＋58复用**，0 fail、无fallback/unclosed，publication58成功；wall7198.017635ms。 |
| 最新quick | 固定10 eligible：**5实际pass＋5receipt复用**，其余59 not-applicable；wall5026.434995ms/P902740.149272ms/mean777.4209188ms，budget passed；publication=false、reason=quick-scope。 |
| Linux冷release | 同tree **69/69 Check passed**，无failed/not-applicable/unavailable，69 execute/0 reuse，elapsed160.4s。prepare/version基线为`a661d059fd782a476d094410c40fe706ff394d3a`，versionIssueCount0；pack通过，dist全部skill zip实际生成，同snapshot授权/打包完成。 |

冷release日志为`.log/vibe-check/isolated-acceptance/release-final.log`；wall160418.253763ms、P9015531.852969ms、mean5857.375613768ms，report-only，未改变原性能政策。它验证上述pending snapshot的打包，不证明未暂存skill内容进入zip。

完整changed性能：wall102604.507809ms、P9012080.263456ms、mean4839.7298366ms；该scope仅report-only，不套quick硬预算。首次cold quick十项实际执行的12.62s保留在历史节，不与最终5实际/5复用合并为同一测量。原quick10、严格预算、全部质量/权限政策不变。

最新完整changed日志为`.log/vibe-check/isolated-acceptance/changed-final.log`；Run、输入计划、性能与receipt机器结果由该日志指向的invocation保存。Review报告和本轮最终状态文档增量不属于上述已受测tree；加入后须按影响核对文档边界，不能把后续实现/index变化沿用为该tree证据。

## 实现提交与最终远端验收

实现提交为`748f9a78f78ebdef64b6d589d2b98331b54ee031`，tree为`19c476a5d9e2d20a49c4b08c215015ac85325747`。本地方才加入的文档增量已在隔离环境重跑changed：14项实际通过、52复用，0 failure/fallback/unclosed，publication58成功，wall16.33s；日志`changed-docs-final.log`。实现提交包含327改动路径，仅比原范围多本方最终范围报告，index树与提交一致且提交后暂存区为空。已授权hook完成自动推送。70个他方working文件与保存的hash全部一致，本记录编辑者也再次只读复核70/70；没有把混合源码或他方Case纳入提交。

[最终workflow run](https://github.com/zxyycom/skills/actions/runs/40117683174)的headSha为该实现提交，三个job均success：

| Job | 实际证据 |
| --- | --- |
| [package](https://github.com/zxyycom/skills/actions/runs/40117683174/job/120942306449) | 2026-10-24 17:46:59–17:49:54 UTC；Linux release 69 execute/0 reuse、69 passed，failed/not-applicable/unavailable均0。 |
| [video-windows](https://github.com/zxyycom/skills/actions/runs/40117683174/job/120942983336) | 17:49:57–17:51:19 UTC；日志TESTED_REVISION精确等于`748f9a78…`。下载同次`skills` artifact **12569432268**，digest **sha256:25c901a7e20c9aa366531185f90276982d7838160b9f5228cc830a2b723a0bf3**；`accept:video-windows`实际执行视频源码及`dist/video-understanding.zip`制品验收，均成功。 |
| [publish](https://github.com/zxyycom/skills/actions/runs/40117683174/job/120943315789) | 17:51:22–17:51:32 UTC，success；既有发布依赖保持。 |

证据保存在`.log/vibe-check/isolated-acceptance/`的`ci-final.json`、`ci-artifacts.json`、`ci-package.log`、`ci-windows.log`；本记录编辑者已读取head/job结论、实际69项结算、Windows revision/下载digest/源码及zip运行边界，不把job名称当执行证据。

## 完成边界与结项

全部实质任务及验收完成，Plan24/24。提交前只读远端核对仍为main `protected:false`、rulesets `[]`（`remote-main-before-commit.json`、`remote-rulesets-before-commit.json`）；本任务未改workflow job身份或远端配置，**PR合并保护未启用，不能声称失败检查会阻止合并**。CI job依赖实际约束了本次聚合发布，这是与合并保护不同的边界。

远端成功证据只绑定实现提交`748f9a78…`。本轮仅文档的全勾完成态及随后finalize删除提交尚未由该远端run测试；它们按影响完成限定机械检查，不能冒称该CI已经验证未来提交。root接续保存全勾Plan，再通过公开finalize预检/执行/list确认退出；若hook节流使结项提交暂留本地，如实报告等待后续正常推送，不绕过hook或手工push。
