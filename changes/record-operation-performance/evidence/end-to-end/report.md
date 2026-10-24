# 1W记录：本轮真实CLI有限配对结果

## 结论与证据入口

**本轮9个代表场景均取得更短wall时间，但收益类型不同，不能合称纯机械优化或统一20x。** selected收窄当前来源观察范围；IR真实rename去除执行时隐式锁前预检，discard复用同次锁内路由/prepare采集；其余完整来源与验收批次采用同安全合同的worker执行。端到端数据不做伪因果分摊。

- 26个正常操作样本：before13、after13，全部产品exit0；另有两版本各7个help核对，不计性能样本。原始JSONL观察26行，补充后验纠正1记录，不是第27个命令/新样本。after没有失败或重跑。
- `results.jsonl`保存真实argv、来源/输入digest、wall/user/system/RSS、原始输出hash和独立后验；`summary-table.md`保留全部值。`audit.json`为实际执行的完整26样本/实体末验结果。
- `archive-inventory.json`、`archived-raw/`、`provenance-manifests/`及`archived-harness/`共57 artifacts/1663879 bytes；52份raw及4份完整manifest的确定性gzip可随Git恢复，不复制源码、依赖或fixture。`audit-archive.py`实际通过，**只核对归档内容，不宣称/tmp清理后仍重新验证实体**。

## wall结果（秒）

selected仅各3次，以中位数给比值，其他仅各1次；比值是此次观察，不是稳定性承诺。CPU和RSS全部原值见`summary-table.md`与JSONL。

| 域/场景 | before全部值 | after全部值 | before/after（selected为中位比） |
| --- | --- | --- | --- |
| DR selected同步 | 35.701 / 36.459 / 35.796 | 4.691 / 2.194 / 1.805 | 16.32 |
| IR selected同步 | 28.880 / 29.040 / 28.583 | 3.077 / 3.117 / 1.811 | 9.39 |
| DR full同步 | 35.681 | 8.812 | 4.05 |
| IR full同步 | 33.041 | 3.609 | 9.15 |
| DR readonly check | 18.505 | 12.596 | 1.47 |
| IR readonly check | 15.155 | 6.426 | 2.36 |
| DR真实rename | 59.387 | 9.324 | 6.37 |
| IR真实rename | 117.667 | 52.492 | 2.24 |
| IR真实discard | 109.762 | 11.013 | 9.97 |

DR selected的4.691s慢值和after跨重复方差完整保留，不把1.805s当唯一结果。**IR rename仍需52.492s，是明显较慢代表**；本轮没有阶段插桩，不能据此断定残余耗时全部必要、全部属于await或已经充分优化。没有为追倍数继续追加运行。

资源不是全面下降：DR full同步maxRSS由350556到401928 KiB，DRrename由452552到503612 KiB，约增加50 MiB。DR check用户CPU8582.8→12253.8ms、system10370.8→2404.4ms，wall虽缩短但user上升；worker/序列化与原领域工作不能只看wall或单项CPU评价。

## 精确来源、输入与计量

before为产品HEAD `1adb98465a7972de3517bf5128a504504419affc`，不是旧报告before值。archive冻结2436文件/11783782 bytes，canonical SHA256 `0c26652805152623a1eaeafb30c567b511206a9e7984aefdd1a5ebc25a39e0f8`。

after为稳定工作树的tracked+新增未跟踪实现/生成闭包，不能只用当时计划HEAD `4c3e35c2`代表：2466文件/12000896 bytes，SHA256 `f086af77ac5f6ea8544f5db3c43f2a3b9936b40e0b38def6309a2dfd8ed9835c`，完整manifest文件SHA `c5308bccab99bfc649df86f8093dc6f25436fb1c9ec8f10e563125e817214833`。复制前/副本/复制后相同；测量从该私有冻结目录运行，不受之后live编辑污染。

两版使用同一独立复制并冻结的已装依赖（10997文件/253961185 bytes，SHA `30312346c53797807a1693188f52d767d0b83a406f6c4e2fd6dba60f08188ab9`）；根package/lock/workspace配置逐字相同，不安装、不改宿主依赖。这不是独立新安装证明。

输入为旧私有fixture精确HEAD `9fdb438df1f4e33722cf6eb131983ba071930d75` 的独立no-hardlinks clone，去掉本轮副本origin、屏蔽宿主Git配置/hooks；旧目录从未reset或修改。每域10000正式、9000稀疏边、2候选，IR资源/owner各1，共20007文件/19196017 bytes；本轮恢复原mode后全bytes/membership核对。sync仅将末项title从`benchmark 261001-record-10000`替换为`benchmark edited-record-10000`一次，严格事务从原HEAD开始且真实改名/删除。26次输入按域/场景digest配对完全相同；完整命令与确认flags见`plan.md`和两份help记录。

Node v26.8.2，每样本新进程，从launch至wait4退出，含Node启动、实际分发wrapper/import、完整操作及CLI输出，非SDK封套。参数除两版入口路径外相同，fixture绝对路径相同。wall/user/system/RSS来自相同外层计量；RSS为高水位，不是区间分配。reset、全输入manifest及独立后验在计时外且会预热OS cache。两版分两个协调quiet窗口执行，**是同输入逻辑配对，不是时间相邻交错，也不是冷cache**。其他代理暂停重型工作，不保证宿主无其他会话负载，不能把方差全归为noise。

## 收益边界：语义、阶段、同保证实现分列

| 部分 | 本轮实际变化 | 本次数据支持什么 |
| --- | --- | --- |
| selected | 从验全集当前来源、只接纳所选变化，改为验已知所选位置/必要依赖，未选沿用发布基线且不检查其currentness、不发现未知位置；仍发布完整index | 两域合法无未选漂移输入上结果相同且更快；**当前来源观察保证有变化**，不能称纯worker/机械收益 |
| IR执行路径 | `rename.ts`仅显式preflight才执行锁外`prepareRename`，执行仍锁内重新prepare及独立fresh；discard入口在锁内采集layout并交给目标路由和prepare，而非重建同阶段layout | static差异与独立native审查承接阶段事实；IR严格事务的总收益混合worker与阶段变化，不能由wall差值分摊各占多少 |
| 完整来源/事务验收reader | 按text/snapshot各自合同保留适用义务（canonical/root/父链/leaf/NOFOLLOW/同fd身份及修订/bytes/mode/UTF-8）；不把两合同不同的mode/realpath义务混同。在每阶段新批次中由单worker串行同步读取；小批及受约束运行时走原async | 两域full/check以及DR严格代表是同观察合同下的端到端改进证据，含整个CLI及剩余领域工作；未单独隔离promise、libuv、syscall或clone成本 |

IR full同步`runSync`与`executeInvestigationIndexSync`的执行入口在两冻结源码间未增加或删除隐式预检；不能把IRrename的阶段变化误套到full同步。正式worker使用1000阈值，批次最多64路径、约8MiB软背压，不截断单文件，不是原微批次一次克隆全部10k结果，因此原读取实验的约20x不能直接套整CLI。fresh、写后验收及恢复的安全正确性由独立审查和原生证据负责，本性能报告不替代它们；本轮没有追加插桩、减少阶段来造性能结果或运行全命令矩阵。

## 独立后验与一次harness纠正

每次核对完整docs delta白名单、未选bytes/mode/entry/revision、metadata指纹、全部entry↔真实source ID/locator、独立v2内容指纹、精确正式数量/稀疏关系形状、资源不变、HEAD/staged内容不变。16个sync的**完整index文本**均等于只替换目标title与revision后的预期bytes；rename检查metadata/body/mode保持、旧对象退出及新对象位置，discard恰移除目标及其一条出边。四个被测readonly check均全文件零改动，并兼作两版当前合同下的合法性证据；额外外部full check为0，而不是“从未运行check”。

before IRrename初次后验把已有0664错误地要求成0600。精确1adb写集明确请求`mode: removal.before!.mode`；根独立确认后，只对保留现场补后验，未重跑产品。原失败row/raw不改，correction绑定原row、旧/新harness SHA及完整修正后验。117.667s仍原来同次测量；26观察+1补充记录不等于27次产品运行。after13次首次后验全部通过。

## 已验证与未覆盖

实际运行：`collect.py --expect-before 13 --expect-after 13`，校验26 raw、配对输入、接受后验、两份source闭包与私有依赖最终不变；`archive.py --versions before,after`及`audit-archive.py`通过。两次采样窗均已结束，没有后续性能运行。仅写本Change证据，无产品/生成/测试/索引改动，无commit/push/Gate或外部写入。

未覆盖：更多重复的统计稳定性、冷cache、10W、全部命令/参数、对抗性故障/并发、不同设备/Node版本，以及各内部阶段的独立耗时。单次full/check/strict不能证明普遍固定倍数或无微小回退。

原始实体仍留两处本代理owned临时目录：`/tmp/record-end-to-end-1adb9846-20261024/`与`/tmp/record-reader-experiment-1adb9846/`，各有artifact-note；本报告没有删除它们。raw/manifest/harness小型归档已进入本Change，后者另有83 artifacts/555316 bytes及离线audit，清理精确owned临时目录后仍可核对证据内容，但不能再声称重新读取已清理源码/依赖/fixture。结项/清理和最终接纳由根决定。
