# Mode 修复后有限测量：已暂停，非最终性能验收

> 历史冻结阶段材料：待修/余项描述仅指当时；当前结论、已关闭问题与复用边界见 [final-report.md](final-report.md)，不据本阶段状态追加测量。

原 baseline65、0–3正常after30、原diagnostic12、pre-mode拒绝/观察均保留。本轮新目录为 `/tmp/unify-record-operations-final-mode-fixed-20261023/`；源码2423路径、11698736 bytes，三方逐路径bytes/hash/mode/symlink一致，manifest SHA256 `d42f0977e2145a536d23a03e2d58983b91d4898c18545e09253af245ce5c87af`。源码快照后来不随真实工作树的安全路径修复改变，不覆盖旧目录。

**本轮取得16个正常观察（最终候选4、旧新交错12）和8个分离计数观察。** 全部退出0且通过精确冻结输入/独立后验；不是全部任务已通过，也不把插桩wall混入正常表。完整数据/argv/输入证明/后验/raw hash见 mode-fixed-attempt-results.json。新安全路径出现显著成本，已按早停规则交原owner；其余矩阵未跑。

## 候选：1W known-formal 跳过已证明

| 域/操作 | 原版正常API ms | 本轮正常API ms | 本轮新建mode |
| --- | ---: | ---: | --- |
| DR new | 6891.2 | 1449.7 | 0664，恢复原umask语义 |
| DR readiness | 3594.6 | 583.9 | 无写 |
| IR new | 746.6 | 1512.0 | 0600，未扩读权限 |
| IR readiness | 405.6 | 548.2 | 无写 |

正式源10k、候选2、所选无关系/直接依赖；两域readiness只打开2个候选，正式源open=0。DR new在prepare/fresh/verify三次身份阶段合计header7（2+2+创建后3），正式源open=0；全1W正式header重读问题已关闭于这个冻结版本。它不证明存在正式直接依赖时不读，后者是产品owner的小例独立义务。

两域new各index parse3、投影30000；readiness各parse1、投影10000。旧IR new有限计数为index parse2/投影20000、body parse3；新IR new body parse1，但增加事务独立阶段、相关index/目标保护与写后验收。IR new慢值没有删去，也不未经范围与阶段判定就全部命名为必要安全成本。各阶段总数不自动证明同阶段重复。

DR new原pre-mode 0644失败永不计成功。本轮严格mode白名单未扩大；原harness临时放宽已撤回。

## 已疑慢组：有限AB/BA实值

| 域/场景 | 顺序 | before / after ms | after/before |
| --- | --- | ---: | ---: |
| DR content | 旧→新 | 44095.7 / 29340.2 | 0.665 |
| DR metadata | 旧→新 | 1135.7 / 1200.6 | 1.057 |
| DR metadata | 新→旧 | 1037.5 / 1082.3 | 1.043 |
| IR metadata | 旧→新 | 849.6 / 1054.5 | 1.241 |
| IR metadata | 新→旧 | 895.3 / 898.2 | 1.003 |
| DR selected sync | 旧→新 | 11279.6 / 67501.6 | 5.984 |

- DR content旧版本本轮44.1s本身高于历史20.3s；历史after28.8s与本轮29.3s都保留。单凭历史不构成稳定回退结论；还未跑反序content。
- IR metadata +24%未在反序稳定复现（+0.33%），不能据此声称已证明noise或普遍等价。DR metadata两轮仍约4–6% wall慢，边界与慢值保留；最终metadata各只parse1/materialize10000/无graph。原DR materialize20000/graph1，原IR materialize10000，不存在观测到的重复JSON/字段准备扩大。
- DR selected的67.5s是优先异常，不被“安全闭包变过”解释为自动批准的成本。该组完成最低区分计数后即停，没有跑完其余矩阵再掩盖问题。

## DR selected：不是全集阶段增加，热点在路径系统调用

原版同轮正常11.28s与历史中位10.97s接近；新正常67.50s的user/system CPU为30.03/36.90s。计数采样wall46.87s只保留为插桩现场，不拿较快值替换正常慢样本。

| 工作量边界 | 原版已归档计数 | 本轮最终计数 |
| --- | ---: | ---: |
| index parse | 3 | 2 |
| source body parse | 20002 | 10002 |
| materializeStateIndexEntry | 50000 | 30000 |
| graph build | 4 | 2 |
| scanDecisionRecords | 旧hook未采 | 1 |
| readDecisionSourceRevision / discoverDecisionSources | 旧hook未采 | 各1 |
| readRecordText | 旧实现无此hook | 20005 |
| 正式source安全open | 旧为readFile，不能当安全open等价数 | 20000 |
| fs.realpath / fs.lstat | 旧hook未采 | 140045 / 166038 |
| FileHandle.stat | 旧hook未采 | 40012 |

观测仍为初次来源与独立fresh两次全集，prepared baseline一次；没有重新引入多次source snapshot/build。readRecordText单次read内现有7次realpath及前后完整inspectSourcePath（包含root/target重复检查），系统调用量是同保证准备复用调查的直接对象，**不能把全部耗时称必要保证强化**。保持安全、父链替换、完整未选状态与独立fresh，再由源码owner判定如何消除重复；性能代理不改产品。

精确交接：normal raw为本轮 interleaved-r1-dr-sync-selected-{baseline,final}/results.json；计数为 selected-counts/results.json；插桩source为 instrumented-selected，原始hash/hook清单为 instrumentation.json。具名hook由 evidence/instrument.py生成；fs/handle计数来自api-worker.mjs。它们是调用量，不是物理I/O，open与read不能相加；Git子进程不在此FS计数内。

## 减少计时外完整check的方法变更

收到减少重复check指令时，旧候选封套已在运行；该命令在安全结束边界共完成4次计时外check。之后改用显式 baseline/final-shared-check-proof.json：复用各冻结版本/领域的已有验收，保留实际验证fixture HEAD/raw provenance；IR tag100变体另有原始严格fixture验收，不假称它与主fixture同HEAD。

**策略切换后新增额外完整check=0；本轮被测check场景尚未运行。** 每样本仍精确reset、输入manifest、文件bytes/mode、选中/未选entries/revision、身份/计数/coverage后验；被测check未来各1，不再在其后额外check。计时区间完全未改，减少外部验收不计作性能收益。旧baseline已得严格check证据不重跑。

## 剩余与任务边界

- 2.2：只有DR selected一组正常配对/最低计数，当前成本待修；四sync热点各3最终样本仍未完成。
- 2.4：有效阶段query证据可按runtime复用分析保留；metadata有限交错已得，content反序、IR合法100窗final代表与少数最终CLI尚缺。旧API业务分支证据不冒充最终import/RSS。
- 2.5：本轮四候选正常与有限计数已得，scope问题的1W直接证明与mode恢复已记录；IR new额外阶段成本及后续共用source改变的影响须单列，不提前称整个性能目标通过。
- 2.8：publish/IR常数小批/set-relations后测未运行。
- 2.9：rename/discard后测未运行。
- 2.10：被测两域全量check后测未运行。
- 2.12：无总体性能通过声明；静态/正确性/Gate由主代理独立负责。当前暂停剩余样本，等待同保证安全路径修复及稳定生成闭包；恢复时只补实际受影响项，保留所有旧慢值和拒绝，不开启全矩阵重做。
