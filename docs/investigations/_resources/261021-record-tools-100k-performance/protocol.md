# 十万条规模调查：方法与证据解释

本文件解释本轮测量；生产实现固定为 Git `5c95358bfd42d8da33d056500c707fc6d5e8069a`，Decision Records version 85、Investigation Report version 74。源码由该 ref 的 git archive 恢复到 `source/`；方法附件的相对导入依赖这一目录布局及兼容的宿主 node_modules。附件用于阅读形成时做法，不是持续维护的基准套件。

## 数据与计量边界

- 正式规模分别为10,000和100,000。真实Markdown经真实同步和全量检查生成索引，不手造来源指纹。每10条一组，共0.9N条边，关系深度1；一条tag、十种tag均匀分组；正文约1KiB，短元数据，无资源。
- 决策每组根archived，其余active修订根；默认查询可见0.9N。调查全部正式可见，叶复查根，额外1个候选。两域载荷、默认页长与返回预算不同，只适合域内扩展对照。
- main worker计时真实领域服务/查询路径：决策内部query handler，调查公开领域函数。elapsed/CPU含返回断言；排除进程启动、模块导入、fixture前提准备及摘要输出。processWall含spawn到close的上述全部；不等于真正CLI参数解析和渲染。
- 每操作独立Node进程、测量任务串行；OS page cache不清空、无独占宿主机或固定CPU频率保证。快项3次，首样本进程wall超过20秒或失败则1次。报告3次的中位数与范围、单次的实际值；不计算p95。
- 进程maxRSS是整个worker峰值，含计时外输入/预构图；heapBefore/After没有强制GC，不是峰值或泄漏证据。stage的Node CPU/RSS不含Git子进程，wall含等待Git。
- micro是不同准备条件下的独立阶段，不能相加为总耗时或据此精确拆百分比。micro超时只证明含setup的worker未在观察窗完成。
- main每进程180秒观察窗；prepare900秒；shape120秒。timeout/非零退出单列，原生content候选硬限保持status:error并单列拒绝耗时。
- Collector在异常stdout/schema/身份断言处可能先中止而未追加该样本；progress保留入口错误。summarize按显式62操作×2规模清点组数、样本编号与自适应次数，缺行不会被解释为0或成功。

## 补充实验

补充形状、CLI、stage各场景均n=1，不采用主矩阵的三次策略。主矩阵124组340次、shape75次、CLI12次、stage12次，共439次观察；四次worker超时分别为Decision100k content-related及三个stage scope，其余保留实际成功或硬限类别。

- shape-worker预构合法的两域merge/star/chain/split，分别1k/10k/100k，每形测build/validate/trace，另测调查type-only merge evidence。全是纯内存micro，不是公开查询端到端。
- shape trace budget50、depth all，计时包括投影、计数断言与JSON序列化。调查调用exported loaded trace；决策镜像private投影封装。输出bytes包括完整直接关系、frontier与blockedEvent，而非只计entry数量。
- 实际分发CLI补测list与metadata common/rare：stdout持续读完，保存字节数、sha256和前缀，不把大量正文存日志。processWall才是spawn到close；preload elapsed是preload执行后到exit、cpu是进程累计，窗口不同。CLI原始前缀和领域worker计数共同用于解释输出；CLI本身仅断言exit0/非空/metrics存在，不声称逐条renderer正确性验证。
- stage只在隔离Git样本建本地HEAD，不连接remote或项目hook；HEAD建立后改变一个已选来源并真实同步，每scope前恢复这个样本的pending到HEAD。测真实stage写入，不把no-change当写入。Gitsetup与来源修改不计时。

## 结果使用

判断先看结果类别与coverage，再看耗时。小page/limit不等于只准备少量记录；小content候选也不等于只读少量来源。V、E、元数据与正文总字节、最大度、拆分归并成员、资源与pending blob总量都是规模变量。稀疏短文档十万条不能证明资源密集或高扇入形态没有问题。
