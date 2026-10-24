# 同安全读取执行模型：有限选型证据

## 结论

在本机、固定715-byte短正文、warm OS cache、10k记录的**读取微批次**中，单worker内串行sync（C）明显快于当前串行async（A）和bounded async 4/8（B4/B8），且保留相同安全观察与后验。推荐实现大批次只读worker原型并接入真实CLI复核；**这不是完整CLI、严格事务或固定倍数收益证明**。bounded也较A改善，但当前数据不支持优先于C。不能仅据此归因“await调度是全部主因”：promise/libuv调度、线程池切换和运行时同步实现同时变化，未单独隔离。

正常结果全部列在 `summary-table.md`，原始40个观察在 `raw-results.jsonl`（8个1k正常、8个1k插桩、24个10k正常）。慢值及插桩loader偏差没有删除。没有产品代码改动、commit、依赖安装、全量check或Gate；本目录是随Change退出的一次性证据，不是长期benchmark框架。

## 来源、语义与后验

- 精确基线：`1adb98465a7972de3517bf5128a504504419affc`，先archive `tools/` 和根package.json至私有工作目录，后续不读live源码。完整1021文件manifest及所需三文件运行闭包的SHA-256见 `provenance.json`；三文件与`git show`逐字节一致，结束再次验收全archive未变。
- A/B直接调用冻结的 `readRecordText` 或 `readRecordTextSnapshot`。C由 `prepare.py` 将同一文件机械去除async/await，并把fs/handle操作映射到对应sync调用，**不改条件、路径检查、读取顺序或证明对象**。类型中的Promise注解仍存在，仅依赖Node strip-types执行，因此派生文件不是可直接合入的正式TS实现。
- text合同保留每文件canonical root、完整路径组件/leaf regular+no-symlink、target realpath、NOFOLLOW open、同fd读取前后stat与dev/ino/size/mtime/ctime、读取后完整父链身份、fatal UTF-8/ignoreBOM。snapshot合同保留canonical root/包含关系、前后父链、leaf、NOFOLLOW、fd与路径身份、bytes长度/mtime/ctime、fd/path mode与返回bytes/mode/parents、strict UTF-8。没有把两种原合同不同的mode/target-realpath义务混称相同。
- fixture完全自建：10000文件、7150000 bytes；root/archive各5000；0640共3334、0644共6666；不是合法领域图/索引fixture。每次返回逐文件SHA与初始manifest一致；snapshot另核对文本、dev/ino/mode及完整父链。每合同同规模的全部模型及重复结果digest相同，结束全fixture bytes/mode/inode不变。
- `fault-results.jsonl`：A/B4/C × 两合同 × leaf-symlink、parent-symlink、root-alias、非法UTF-8、越界、目录leaf、缺失、确定性readFile完成后改写revision，共48次均拒绝。B8安全实现与B4一致，但未另跑故障矩阵。未覆盖父链交换竞态、所有并发故障、mode-only漂移、真实worker崩溃/取消及跨平台差异；有限探针不代替产品安全测试。

## 计时与操作计数

每样本新Node v26.8.2进程，默认libuv pool，不清OS cache；先1k，再10k三个交错次序 A/B4/C/B8、B8/C/B4/A、C/A/B8/B4。计时窗协调其他任务不跑Gate/聚合；不能排除宿主其他调度。10k各模型每合同仅3次，不作统计显著性承诺。

`metrics.wallMs`从选择模型前到整批结果可用及worker退出，包含reader模块import，C另含新worker启动、完整结果structured-clone回传及退出。text回传7.15MB正文，snapshot同时回传bytes+text约14.3MB及全部身份/父链对象。未逐文件/逐syscall启动worker；未计入父Node解释器自身启动与脚本静态import，也未计入独立后验。`processWallMs`额外含解释器/静态import和后验，**不能当纯CLI耗时使用**。user/system是该计时窗process CPU（含worker与线程池）；RSS是进程高水位，不是区间分配量。所有原始字段保留。

10k C三次：text wall640/822/735ms，worker读批次557/686/640ms；snapshot wall763/582/612ms，读批次588/449/484ms。非读批次余量分别83/136/95ms及175/133/127ms，含启动、模块装载、clone/delivery和退出。online分别约28–51ms；减online、reader import与读批次后，到receive的剩余分别22–30ms与63–100ms，**不是隔离的纯传输计时**，还含worker脚本bootstrap与消息调度。主线程5ms heartbeat maxLag也保存，但可能遗漏最后一次消息反序列化附近的阻塞，不能据该值承诺响应SLA；主线程响应与命令总耗时分别评价。

| 1k合同 | 每个A/B4/B8及纠正后的C：realpath / lstat / open / fstat / readFile / close |
| --- | --- |
| text | 3000 / 7000 / 1000 / 2000 / 1000 / 1000 |
| snapshot | 2000 / 5000 / 1000 / 2000 / 1000 / 1000 |

这是显式FS API观察，不是系统调用或物理磁盘I/O计数，不能相加宣称物理I/O。正常计时不装计数器。原始C插桩在import前安装，误将loader的4次realpath和3次open/readFile/close一起计入，原值保留；`counts-corrected.json`仅追加两个1k C计数样本，把计数器装在import后，精确恢复同一批次工作量。纠正样本不混入正常性能表。

## 最小生产接入建议

1. **API与生命周期**：内部批次入口可为 `readRecordBatch({ root, paths, kind: 'text' | 'snapshot', signal })`，输出按输入顺序的原合同结果。一次读取阶段一个worker、一批路径；不跨阶段缓存，不把事务mutation/recovery搬入队列。取消时不接受部分成功，确保终止/退出/关闭完成并释放消息listener；worker异常/非零退出/失联都失败，路径和原始错误归属要可恢复。逐文件fd继续finally close。
2. **领域接入**：DR收集路径及额外regular门禁保留在原owner，批量安全读取后按原顺序做ID/duplicate/parse；IR布局/资源/领域闭合仍在原owner。strict preparation返回真实root/path绑定的完整snapshot，不重锚父链。fresh、postverify和每一验证phase均发起新批次真实观察，不能重用prepare的worker结果替代。
3. **共享原语**：text与snapshot保留各自安全合同，共用现有identity/修订/UTF-8等纯验收原语；避免维护两套逐步演化却测试不一致的安全算法。机械变换只是选型证明，不建议产品运行时动态改写源码。工作线程入口独立、协议窄，不引全局pool、缓存或通用事务框架。
4. **运行时/分发**：正式实现必须覆盖Node实际TS worker入口、Node最低支持版本与Bun维护/测试运行方式；DR/IR各自同步完整源码闭包及声明，不依赖另一个skill安装或实验/tmp路径。实验只跑当前Node，未证明Bun worker或独立分发兼容。
5. **顺序与取消**：C批次天然串行，遇第一个坏输入失败；B的Promise.all可能先返回不同顺序失败，若采用B需保持原先ordered诊断，并等已开始读取收尾。领域AbortSignal不能通过structured clone直接传函数/任意对象；主线程控制消息/terminate和worker文件间取消检查需明确，不能忽略原有abort语义。对抗性永不结束syscall的取消时限本次未验证。
6. **小批策略**：仅5项smoke中C约145ms而A约44ms，1k已明显有益；没有测中间规模，不能给出最优阈值。保守先对明确全量/strict大批且至少1000项启用C，小selected维持现有async；1000只是已测的最小有益规模，不是最佳交叉点。后续只需少量真实CLI/严格事务配对验证，不追加全命令矩阵。

## 复核与归宿

`prepare.py`准备fixture/派生sync；`reader.mjs`为可接入的只读batch原型；`measure.py`执行既定有限样本；`fault-probe.mjs`/`probe.py`是一次性故障探针；`audit.py`核对40样本、原始stdout hash、48拒绝、纠正计数、跨模型digest和source/fixture最终不变。`audit.py`实际通过；这不是产品测试或正式安全审查。

辅助物保留在 `/tmp/record-reader-experiment-1adb9846/`：source archive及sync派生、两个manifest、fixture、faults、原始stdout/stderr、纠正计数派生脚本，详见该目录 `artifact-note.md`。该Change结项后可删除此精确私有目录，不能据此删除其他历史fixture。小型脚本/指标/报告留本Change；最终产品验收与是否接纳由根代理负责。

## 小型归档补充

计时结束后的归档保留80份原始stdout/stderr（24523 bytes）、完整source/fixture manifests确定性gzip、纠正计数派生harness，共83 artifacts/555316 bytes，位置由`archive-inventory.json`映射。`audit-archive.py`实际通过40观察、48拒绝、2纠正计数与全部归档hash核对；它只读取本目录归档，不访问/tmp或重新运行读取实验，也不宣称/tmp清理后重新验收实体。原先实测/计数/故障数据没有重跑或覆盖。
