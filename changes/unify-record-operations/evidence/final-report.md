# 1W 记录操作：最终有限配对证据

## 结论与读取入口

本次有限配对确认了候选范围、安全读取内的路径解析、严格 prepare 与验收 phase 的机械去重；**IR 严格操作与两域全集来源扫描仍明显慢于 baseline**。新增安全保证的成本与机械去重分别评价，不能据此宣称全面提速或全部性能通过。最终稳定 Gate 尚未执行。

- 指标、命令、精确输入、独立后验与来源见 [final-results.json](final-results.json)；wall/user/system CPU/maxRSS/输出字节见[摘要表](final-table.md)。所有历史慢值、失败与源码阶段保留，正常计时和插桩分离。
- 归档 **153 个接纳的正常计时观察、25 个分离计数观察**，含历史与交错，不是 153 个最终独立场景。primary baseline 为 **67**（原 65 + 补旧 CLI 2）；最终有限代表 **42**，其中最新字节闭包直接实测 **6**、明确业务复用 **36**。pre-mode 四个 attempt 和 baseline 三个拒绝另存，不计成功性能。
- 最新快照的三个真实 CLI 代表覆盖各自当前启动/import/渲染；36 个业务复用代表仍保留原快照指标，不能据此推导最新完整 import/RSS 等价。
- 已定位并处理的机械问题见下文直接计数；剩余较慢的 sync、严格事务、check 及 metadata 不确定性照实保留。G4/G5 的新增安全、CAS、fresh/readback 责任属于保证成本，但现有证据不证明所有剩余成本都必要或不可优化。

## 输入、来源与计量

基线为精确 HEAD `5d6a73fb51ef1d9c2b0311e160cbd42a04576f42` 的 archive，不受当前未提交源码影响。主fixture是无remote、独立完整Git HEAD `9fdb438df1f4e33722cf6eb131983ba071930d75`；每域10000正式记录、9000合法稀疏边、2候选、固定短正文，IR资源/owner各1。DR合法归档/active/alignment及关系由生成器和原始严格验收共同证明。

IR content变体仍1W库存，仅固定tag选择末100条，独立HEAD `6736a70714f4358277773874de09c14e963e1206`。全1W命中的原版2000文件budget拒绝永久作为边界，不能计成功性能或回归；DR content扫描1W，不横比两域绝对时间。

| 来源阶段 | manifest | 用途 |
| --- | --- | --- |
| 原版精确archive | source-manifest.json | 65原始正常及后补两个CLI，另保留交错旧值 |
| 已审0–3 | after-0-3-source-manifest.json | 阶段30正常、查询业务证据；旧候选scope问题不复用 |
| pre-mode尝试 | final-source-manifest.json | DR new权限差异拒绝，四个attempt不计最终正常 |
| mode-fixed | final-mode-fixed-source-manifest.json | 候选/metadata/content/selected交错及重复realpath诊断 |
| same-read source-opt | final-source-opt-manifest.json | 四sync各3、候选4、普通事务5、check2等正常27；旧strict4被新代表替换 |
| strict prepare-opt | final-strict-opt-manifest.json | 严格4、content2及旧content反序1；DRdiscard与content保留有效 |
| 最终phase-opt | final-phase-opt-manifest.json | 正常实测6（严格控制3、CLI代表3），另有IR计数1；完整三方冻结 |

最后快照 `/tmp/unify-record-operations-final-phase-opt-20261023/source`：2435路径、11783177bytes，manifest SHA256 `84104a6dc89b064c39ba4c16d3397868e42ebbb95d14852dcb72e218ed41edbb`。按真实工作树tools/skills/scripts及根依赖配置复制，before/copy/after逐路径bytes/hash/mode/symlink一致；包括未跟踪新helper。完整清单只留/tmp，复制后移除写位、字节不变。依赖复用宿主node_modules仅为源码测量，不代替主线程独立安装证据。

API每样本新Node进程，import后开始wall/CPU；DR固定公开dispatcher，含参数解析/渲染，IR固定typed API，JSON序列化在timer外。API CPU不含Git子进程，wall含等待；CLI用实际Node入口launch→wait4，含启动/import/输出。RSS为截至采集点进程高水位、含import；不是区间分配量。计时后IR序列化不计入API RSS采集点。两域API封套不等价，API/CLI不混算。

OS cache不清，reset/manifest读取会预热；无其他Gate/重型任务并发。full/selected都只改末项title，metadata全命中但返回窗口5。四sync热点各3；metadata原阶段各3及有限AB/BA保留；其余代表1。不遍历全命令×flags×两入口，不测10W。

## 精确后验与额外 check 边界

每次仅reset受控私有fixture，严格恢复同HEAD、完整来源bytes/mode manifest，保存域输入digest。每个样本独立核对文件delta白名单、未选bytes/mode/entries、所选完整entry投影、frontmatter ID/locator、全量entry与sourceRevision membership/fingerprint、正式计数/边数及查询窗口/count/coverage。所有接纳样本exit0且后验通过；新建DR0666受umask0002得到0664、IR0600，无0644扩白名单。index同步12样本另有仅title及v2revision替换的整个index字节SHA匹配证明。

自用户要求减少额外 check 生效起，新增的**额外外部全量 check 为 0**。这不表示没有被测 check、没有后验或从未运行全量检查：两域被测 check 各 1 个正常代表，沿用其实际快照；逐样本精确输入与独立后验继续执行。此后未追加 check/publish 诊断，也未因最终冻结路径改变重复全量 check。共享 proof 保留实际旧 receipt/fixture HEAD，IR tag100 使用自身初始合法 proof，不把旧证明改称新源码/hash 已重新实测；计时区间不变，减少外部验收不计性能收益。

历史成功cohort记录的额外check receipt为baseline37、0–3阶段18、原始计数12、mode-fixed策略切换前4，共71；初始两套fixture各两域check4及pre-mode尝试4另列。这里只审计保留的receipt，不声称完整重建所有早期失败尝试的进程总数；没有为补计数重新执行检查。

## 工作量与保证必须分列

### 机械去重的直接证据

1. **候选范围**：合法发布索引含1W已知formal，实际候选2、所选无直接依赖。两域readiness正式header/open为0；DR new三身份阶段header合计7（2+2+3），formal0。不是降低选中安全检查。正式直接依赖仍读1属于主线程小例证明，不伪称本无依赖1W负载覆盖它。创建mode修复前DR0644失败留档，永不计成功收益。
2. **同read路径**：DR selected正式安全open20000、两全集阶段不变；realpath140045→60025精确少80020，lstat166038/handle.stat40012及index/source/graph工作不变。67.502s→首35.592s只是两中间快照各一次正常观察，不承诺倍数。最终有效三次selected为35.592/35.974/45.307s，全部保留。
3. **严格prepare**：DR锁内formal acquire10000/bodyparse10002（含两候选）一次，txn.prepare正式open0、仅改变正文parse1、proof交接10003。原总formal open50000→30000、bodyparse30004→10003。IR锁前与锁内是两个独立prepare，各formal acquire10000；txn.prepare正式open0，同phase捕获/guard/write不再重复采集。root-bound proof不是裸复用collection-root文本。
4. **共同phase与IR写后**：最后IR分离计数在 `final-results.json:strictCountsSeparate`：freshguards正式open20000→10000，postguards19998→9999；写后当前layout正式snapshot9999/parse10002，独立native indexfresh另9999/parse0；总formal open119996→89998、bodyparse40010→30008。两prepare各正式10000、各native indexfresh10000、fresh-domain10000仍真实IO。同phase重叠writes/guards只对已成功实际观察且expected相同的root/path proof复用，各fresh/postwrite phase全新Map，不能跨phase缓存。失败proof不入Map，expected漂移仍真实读取。IR写后只复用本领域当前验证layout/doc，不传共同→领域postfacts协议。

IR postwrite重复layout/bodyparse在原HEAD已存在，不是本轮新回退；共同noop writes/guards重复是共享事务新路径，二者分别追溯于 `strict-opt-phase-findings.json`，最后源差异及DRdiscard复用见 `final-phase-reuse-proof.json`。不把跨阶段调用总数称同阶段重复，fs.open/read/handle计数也不是可相加的物理磁盘IO。

### 实际保证改变/强化成本

| 保证 | 原版与当前职责差 | 性能解读 |
| --- | --- | --- |
| G1查询依赖门禁 | 无关系content/metadata不再强验无关全集关系/owner图；metadata完整计数、窗口DTO仍保留 | 图门禁收窄是产品改变；减少重复parse/projection是机械改进，二者不混称无损 |
| G2 readonly check | 当前验证首次采集，不追加结束fresh；仍执行本域合法性/index检查 | 去除第二阶段改变观察点；原raw read到G5安全读取的实际成本另计，check变慢不被藏掉 |
| G3候选与发布投影 | 合法index提供未读正式身份/位置；实际候选/直接依赖安全读取，缺index/未知位置才扩展 | known-formal skip是范围修复，不以削弱所选安全换收益 |
| G4事务封套 | prepare→独立fresh→CAS写入→真实readback→cleanup/recovery，目标/index/成员及实际mode保护 | IR new/index准备3次对旧2次、普通发布及严格操作增加阶段；阶段总数不是每一处实现成本不可减的证明 |
| G5来源/事务安全 | 原scan直接readFile、fresh常规lstat/readFile；当前canonical root/target、前后父链/leaf、NOFOLLOW、同handle身份/size/mtime/ctime与严格UTF8；严格snapshot/CAS绑定真实namespace | full/selected原有两来源轮并未新增为更多轮，但每file职责实改；不拿0–3较快不安全闭包作最终同保证比较，不称全部余量必需 |

## 方差、慢值与有限结论

DR content原历史20.291→28.825s；AB44.096→29.340s，BA20.087→20.217s（顺序为final→old）。未稳定复现固定回退，也未证明所有波动都是noise。IR content100为734.0→572.4ms各一次，不扩展成全1W扫描承诺。

metadata有限两轮：DR旧→新1135.7→1200.6ms（+5.7%）、新→旧1082.3→1037.5ms（after仍+4.3%）；IR849.6→1054.5ms（+24.1%），反序898.2→895.3ms（+0.33%）。DR小慢值保留；IR大幅差未稳定复现。最终metadata各index parse1/projection10000/graph0，未见重复准备扩大；**较少counts不等于wall已证明等价**。不继续为小差异追加矩阵或承诺统计无回退。

严格操作修复前后全部正常值保留，不选最小：DRrename84.253→52.225→52.729s；DRdiscard83.490→67.557s；IRrename198.637→149.419→111.972s；IRdiscard146.570→108.694→109.040s。DRdiscard写/guard集合本来不重叠，最终只新增phase bookkeeping，原实测按相同读取职责复用；不伪称最新完整启动/RSS。普通事务的新Map微小开销不逐场景重新计时，属于复用边界，不断言其数学上零成本。

已取得的有限代表没有剩余已定位且未处理的同prepare机械扩大证据；这不是所有负载/故障/并发或微小稳定回退的统计证明。没有固定倍数目标，也不据较慢值删除已批准G4/G5职责。未来仍可优化，但本次不引跨phase缓存或泛化遥测框架。

## 任务证据与未覆盖

| 任务 | 直接证据与边界 |
| --- | --- |
| 2.2 sync | 四热点各3；source-opt正常12、selected分离counts、整index字节proof。0–3未覆盖后来storage-sync安全baseline read，故没有误复用该旧12。最终只phase事务变化，不再重跑sync。 |
| 2.4查询 | 两域窗口list/relations/show业务复用，metadata原阶段+AB/BA/计数；DR全存量content反序与IR合法tag100；最新IRmetadata CLI。保证门禁变化与RSS/import边界单列。 |
| 2.5候选 | 四正常、1W formal header0计数、原生mode严格后验；最新DRnew CLI；必要直接依赖仅小例证明。原0–3慢值与pre-mode失败全留。 |
| 2.8普通事务 | DR单publish/set-relations、IR单publish/两候选批/set-relations正常5，全部所选/未选后验；共同stage由strict计数与主线程两适配器native证明，不额外跑publish诊断。 |
| 2.9严格事务 | 最终DRrename控制、IRrename/discard正常及IRcounts；DRdiscard前轮有效复用；Git完整HEAD确认、root-bound proof与fresh/CAS/postguards均不偷删。 |
| 2.10全check | 原/新每域正常各1；G2首次采集由产品native/独立审查证明，不捏造本目录不存在的check计数。观察点与G5安全成本分列。无check诊断、不为新路径再验全图。 |
| 2.12成本结论 | mechanical范围/同read/prepare/phase问题已定位并有限关闭；安全/产品保证变化、慢值和有限不确定性明确。任务勾选/总体接受由根审计，不由本报告宣布。 |

未测：DR常数evolve批正常成功（原请求被合法性拒绝，未算性能）、全参数/异常/并发矩阵、10W、所有CLI最终RSS、冷OS cache、长期统计稳定性。原生/故障/独立分发/Case与最终Gate由主线程负责；本轮只运行封套输入和后验、分离插桩及证据语法/JSON审计，没有自行跑Gate或产品聚合测试。

## 可复现与归宿

`generate.py`、`freeze-source.py`、`measure.py`、`api-worker.mjs`是生成/冻结/正常入口；`instrument.py --phases`只改受控/tmp分发副本；`run-phase-final.py --stage cli`是最后5 CLI清单；`collect-final.py`汇合而不运行产品。完整实际inner argv逐样本保存，外层参数/常量路径写在脚本，不依赖历史调查资源。所有源码/fixture/raw输出留受控/tmp，证据小型配置/指标/说明留本Change，结项随Change退出，不进入长期benchmark或稳定docs。

已对测量Python做AST解析、JSON完整解码、正常/计数分离与数量、raw hash/provenance及复用集合去重审计；这不是产品测试。最新CLI实测DRnew1686.4ms对旧7354.4ms、DRselected35480.4ms对旧11303.4ms，IRmetadata1156.5ms对旧CLI三次中位1049.9ms，各当前代表一次，不作稳定倍数结论。

性能采样窗口已结束，不再加测；主线程完成报告窄审后，仍须针对最终稳定输入运行完整 Gate。任务勾选与总体接受由主线程结合上述收益、成本和未覆盖边界判断。
