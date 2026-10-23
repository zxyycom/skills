# 严格准备去重后：有限证据与剩余重叠

> 历史冻结阶段材料：待修/余项描述仅指当时；当前结论、已关闭问题与复用边界见 [final-report.md](final-report.md)，不据本阶段状态追加测量。

这是冻结阶段的实际结果，不是总体性能通过声明。`strict-opt-attempt-results.json` 保存正常7样本（最新源码6、baseline反序content1）、分离计数2样本、全部wall/user/system CPU/maxRSS/输出字节/argv/输入与独立后验/raw hash。历史65 baseline、30阶段after、16 mode-fixed、27 source-opt正常观察及全部失败/慢值均未覆盖。

## 冻结与执行边界

最新快照 `/tmp/unify-record-operations-final-strict-opt-20261023/source`，2431路径、11769315bytes，manifest SHA256 `c5161210fd109dea5cc1d6faf22dbb3dbfdb215596699e67619012f94d1459fe`。实际工作树before/copy/after逐路径bytes/hash/mode/symlink一致，包含未提交新helper及生成闭包；不是archive旧HEAD。复制后仅移除写位，宿主依赖链接只用于源码测量。小型证明为 `final-strict-opt-manifest.json`，完整文件清单留受控/tmp。

本阶段新增额外全量check **0**，被测check亦 **0**。复用真实旧验收receipt及fixture HEAD，不伪造新hash实测；default noCapture分支与函数搬家差异见 `final-runtime-reuse-proof.json`。每次仍精确reset并独立校验bytes/mode/entry/revision/identity/locator/count/coverage；七个正常、两个插桩样本均exit0与后验通过。计时封套未改，省去外部重复check不算收益。

| 公开入口场景 | baseline正常API ms | 本阶段正常API ms |
| --- | ---: | ---: |
| DR rename | 33502.6 | 52224.5 |
| DR discard | 34382.4 | 67557.2 |
| IR rename | 17184.5 | 149418.7 |
| IR discard | 7689.6 | 108694.5 |
| IR content tag100 | 734.0 | 572.4 |
| DR content反序 | 20217.4（随后） | 20087.0（先） |

严格操作各代表一次，不声称倍数稳定。DR API为dispatcher含解析/渲染，IR为typed且序列化计时外；不横比两域绝对数。IR content仍1W总存量，固定tag只选100；原全1W命中budget2000拒绝保留，不是成功或回归。DR content历史20.291→28.825秒、AB44.096→29.340秒与本轮BA20.087→20.217秒全保留，不能只选最快值或认定噪声已证明。

## 同prepare读取/解析/快照交接已消除

`strict-opt-phase-findings.json`为两个计数样本的完整raw/hash与逐phase投影；插桩wall不混正常样本。marker只在已核对的成功顺序边界，flat与stage子数是相同调用，不能相加；formalSource分类只匹配原fixture文件名，新rename目标不在该计数内。

- DR锁内prepare：正式acquire10000，正文parse10002（含2候选），强snapshot一次。txn.prepare正式open0，requireSnapshot10003，parse1仅改变正文；原二scan+capture再读+未变正文再parse已不发生。总正式open50000→30000、bodyparse30004→10003；fresh guards10000、postguards9999及write1保留真实IO。
- IR preflight与锁内prepare各自正式acquire10000、bodyparse10003；二者是独立阶段，不合计成同prepare重复。每次native indexfresh另读正式10000，单独marker。txn.prepare正式open0，requireSnapshot40010，新增目标不存在性snapshot1；同prepare guard/write交接已不再重读。
- root绑定、严格UTF8、父链/NOFOLLOW/handle稳定与成员/CAS/资源保证由产品独立正确性审查负责，不以减少读数替代这些义务。

## 仍须交根判定的同phase重叠

IR不是“剩余全部必要安全成本”：

1. `renameOriginalGuards`收集全部原source；`renamedSourceWrites`也把全部sources（含未改正文noop）交writes。common `verifyPlan`先writes后guards无同path排除，`verifyWritten`仅按actuallyWritten排除guard，未改noop重叠仍在。观测freshguards正式open20000、postguards19998；不能把同phase两次同path保护自动命名为两个fresh。
2. `verifyCommittedRename`先collectValidated完整集合，随后`readCurrentCandidates`再inspectLayout且未关闭formal读取，最终`asFormalSource`又解析已经验证的formal。观测postwrite-domain正式open29997/bodyparse20004，含另一独立native indexfresh。布局重取/正文重parse与native fresh职责须区分。

只读追溯确认第2项在精确baseline HEAD的rename-verification.ts已存在，不能称本轮新增回退；第1项共同事务重叠另列，不混作历史问题或全部必要成本。

最低计数已取得后停止后续CLI，不追加大扫或check。性能代理没有改产品源码。root收到raw/marker/调用者证据后决定是否同保证去重；不自行删除观察或扩白名单。

## 精确剩余与复用

已完成content有限清单，不再重做。尚未启动的CLI仅5个：最新DRnew/DRselected/IRmetadata各1，缺少的原版DRnew/DRselected各1。若源码再变只补真正受影响closure，四sync12、候选四、两域readonly check及普通publish/关系五个正常业务证据可按 `final-runtime-reuse-proof.json` 的实际默认分支证明保留；**不是最新完整import/RSS字节等价**。metadata已有AB/BA和counts，不继续扩采。

`collect-final.py`与`run-strict-final.py`是已准备的最终有限收口入口，前者要求5个CLI结果存在才汇合；当前尚未执行最终汇合，不把计划当已测结果。最终report与任务状态由完成后的实际证据决定，Gate由根串行负责。
