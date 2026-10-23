# 安全路径同read去重后：阶段证据，严格事务准备待修

> 历史冻结阶段材料：待修/余项描述仅指当时；当前结论、已关闭问题与复用边界见 [final-report.md](final-report.md)，不据本阶段状态追加测量。

本阶段已停止测量与写入，不是最终性能验收。正常27样本、分离计数2样本全部保留于 source-opt-attempt-results.json；完整指标表为 source-opt-attempt-table.md。所有退出/输入/独立后验均成功，不能因此称运行编排已无重复。旧baseline、0–3、pre-mode拒绝、mode-fixed慢样本不覆盖。

## 来源与方法

快照 `/tmp/unify-record-operations-final-source-opt-20261023/source` 来自当时已审工作树与生成闭包，非archive HEAD。2423路径、11703199 bytes，before-current==copied==after-current逐bytes/hash/mode/symlink一致；manifest SHA256 `c4911f3d7a8a523422440f6eea99fcda52e5ea56f6058eef1988071398037f6d`。真实工作树后续修复不污染此快照。

同主fixture HEAD、公开入口/计时封套；OS cache不清除，reset/manifest预热与独立后验在计时外。DR API是dispatcher含参数解析/渲染，IR为typed调用、序列化在计时外；不跨域比绝对值。API CPU不含Git子进程，RSS取调用结束时截至该点的进程高水位、含import；不把旧业务分支复用称最终import/RSS等价。

复用共享合法proof后，**本阶段额外完整check=0**。两个被测全量check各1，没有再check；每样本精确reset/字节mode/entry-revision/身份locator/计数coverage后验仍执行。12个sync样本还以冻结Git index原字节仅替换声明的title及v2 revision，独立精确匹配整个发布index SHA256，未重读1W来源或运行额外check。

## 三条必须分开的结论

1. **同read机械去重：** selected诊断realpath140045→60025，精确少80020；两全集来源轮、lstat166038、handle.stat40012、正式open20000、domain/source/index准备次数没有减少。该去重保留原安全语义，无跨read/phase缓存。
2. **中间版本wall观察：** source优化前正常67.502s，优化后首正常35.592s，均保留；这只是不同冻结中间版本的各一次正常观察，不承诺固定倍数。计数时间不替换正常值。
3. **对原版成本不同：** 原版同轮11.280s仍明显低于本阶段35.592s。原首次scan直接路径readFile、fresh仅regular lstat后readFile；当前每次读取增加canonical root/target、前后父链及leaf身份、NOFOLLOW、同handle dev/ino/size/mtime/ctime与严格UTF8观察。逐职责报告成本，不声称同保证无损加速，也不声称剩余所有检查都不可再优化。

## 已取得覆盖

- 四sync热点各3（12）：DR full 43.926/41.370/36.179s；DR selected 35.592/35.974/45.307s；IR full 27.418/29.034/29.022s；IR selected 29.105/42.057/30.897s。所有慢值与方差保留。
- 候选4：DR new1443.7ms/mode0664，readiness465.0ms；IR new1382.0ms/mode0600，readiness480.0ms。known-formal scope的既有1W计数证明不因只减少同read系统调用而失效，最终必要补证仍绑定真实闭包。
- 事务/check11：两域单publish、关系替换、rename/discard/check各1，IR两候选小批1。全部后验通过；其中DR rename84.253s/discard83.490s，IR rename198.637s/discard146.570s，未把慢值藏作安全成本。普通发布的所选ID集合/完整entry投影及未选bytes/mode/entry-revision均核对。
- readonly check正常：DR17.936s、IR14.551s。G2为首次采集而非结束fresh，不能将保证改变称无损收益；相关分离check计数尚缺。

## 优先阻断：DR严格rename同锁prepare重复

正常DR公开dispatcher路径未请求preflight；进入withCollectionLock后只有一次applyDecisionRenameWithinLock。固定阶段诊断不建立异步上下文/缓存/注册框架，只在已核对的顺序调用点标记；flat总数与stage子数是同一批调用，不能相加。raw为 counts-dr-strict-phases/results.json，副本为 instrumented-strict，方法为 instrument.py --phases、worker环境 RECORD_PERF_PHASES=1。

| 固定阶段 | scan | readRecordText | readRecordFileSnapshot | 正式source open | body parse |
| --- | ---: | ---: | ---: | ---: | ---: |
| 入口/锁前 | 0 | 0 | 0 | 0 | 0 |
| rename.locked-prepare | 2 | 20006 | 0 | 20000 | 20004 |
| txn.prepare | 0 | 0 | 10004 | 10000 | 10000 |
| txn.fresh-domain | 0 | 0 | 0 | 0 | 0 |
| txn.fresh-guards | 0 | 0 | 10004 | 10000 | 0 |
| txn.write | 0 | 0 | 8 | 1 | 0 |
| txn.postwrite-guards | 0 | 0 | 10004 | 9999 | 0 |
| txn.postwrite-domain | 0 | 0 | 0 | 0 | 0 |

fresh-domain/postwrite-domain分别一次成员集核对，不是body扫描；common txn run1、verifyPlan1、verifyWritten1。总正式open50000、realpath120072/lstat450207/handle.stat100047；插桩wall86.986s不当正常值。

确定调用者：decision-rename.ts先prepareDecisionRenameAtCurrentState(loadDecisionValidationContext安全scan)，随后显式const current=await scanDecisionRecords(options)，再把current交applyLockedDecisionChanges。二scan都在同锁prepare，不能伪称两个独立fresh。prepareDecisionTransactionPlan又captureDecisionTransactionSources逐records绑定CAS snapshot；projectDecisionTransactionIndex无publishedBaseline分支经buildDecisionStateSnapshotFromSources再parse10000。

**此处仍需同阶段事实交接审查。** collection-root来源证明与workspace-root CAS证明锚点不同，不能裸复用；不能为了减少读数删独立fresh/写后证明。精确raw/marker与源码位置已交事务owner及根，性能代理没有改产品。IR静态布局/guard重复由owner调查，不把尚未采的IR阶段数字捏造为与DR相同。

## 余项与复用边界

当前在重复实现上暂停：IR content100最终代表、DR content反序1轮、少数最终CLI（含缺旧CLI配对）、其余sync/候选/事务/check有限counts未运行。metadata旧新两轮原值保留：DR +5.7%/+4.3%，IR +24.1%/+0.33%；有限样本不能以counts较少冒充wall等价，也不归为已证明noise。

后续只按真实修复闭包补受影响项；本阶段四sync、两域check、候选和普通事务有效结果不自动作废，但业务证据复用须有运行路径证明，import/RSS边界仍另列。严格rename/discard的正常慢值与重复诊断保留为修复前证据，修复后需必要配对。

任务证据：2.2已有四sync各3及整个index bytes证明；2.5候选四正常及已得scope计数；2.8普通publish/小批/关系替换已取得正常代表；2.9严格正常代表已得但同锁prepare重复待修，不能性能勾完；2.10两域check正常代表已得、阶段计数尚缺；2.4仍缺上述content/最终CLI；2.12无总体无回退/性能通过声明。产品小fixture/Case/分发/Gate由根独立负责，非本目录取样替代。
