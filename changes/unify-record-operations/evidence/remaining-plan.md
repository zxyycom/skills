# 有限性能清单：已收口，不再追加取样

性能采样已结束，本文件只保存已完成链路与交接边界，不再安排测量。结论以 [final-report.md](final-report.md) 为准；[final-results.json](final-results.json)与[摘要表](final-table.md)保存实际数据。最终稳定 Gate 尚未执行。

## 已完成的有限链路

1. 精确HEAD baseline65保留，不重做；原版缺少的真实CLI new/selected各补1。两域合法1W输入与IR tag100独立变体保持原HEAD。
2. 实际工作树多阶段新目录冻结，逐路径before/copy/after bytes/mode/symlink一致；失败/慢值/旧manifest全留。
3. 四sync热点最终有效各3；metadata已有阶段样本与最多两轮AB/BA，DR selected机械realpath问题取得最低证据后即交owner，未无限重复。
4. 候选四正常与1W known-formal header0直接计数、mode严格后验；必要正式依赖1仍属产品小例证明，不伪称无依赖负载覆盖。
5. 普通publish/IR两候选批/set-relations五正常、两域readonly check各1；不再补check/普通publish诊断。
6. 严格prepare与phase重复先后定位/修复；最后仅补IRrename/discard各1、IRrename计数1、DRrename控制1。DRdiscard保留前轮实测与无重叠loop复用边界，不展开全部普通事务重测。
7. content有限补证完成：DR反序final→old一对、IR tag100最终代表1。两域命中规模不同，不比绝对数。
8. 最后真实CLI仅5：最新DRnew/DRselected/IRmetadata各1，缺旧DRnew/DRselected各1；不扩全场景×两入口。

## 未覆盖不转成追加任务

没有10W、冷OS cache、全参数/异常/并发矩阵、每个入口最终RSS或长期微小稳定性证明。DR常数evolve批原请求拒绝，不计成功代表。metadata微小慢值及所有大慢值均保留；不因counts降低就承诺wall等价，不称两域全面加速或“性能全部通过”。保证变化与同保证机械去重分列。

用户减少额外 check 的要求已落实：生效后新增额外外部全量 check 为 0，被测 check 两域各 1 个代表不再二验；逐样本精确 reset 与独立 bytes/mode/entries/revision/identity/count/coverage 后验保持。合法 proof 保留原实际 HEAD/raw 来源，不视为新 freeze 已重新 check。

## 交接

性能owner完成数据/报告/方法语法与provenance审计后停写。下一步由主线程做ai-ready报告窄审、唯一稳定完整Gate及任务结项；本目录不自行运行Gate、生成、原生聚合测试或Git写入。源码若非本次已冻结闭包，不能把已有启动/RSS默认提升为其结果。
