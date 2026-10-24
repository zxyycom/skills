# 整索引计算与传输实验协议

## 固定输入与比较范围

实际冻结仓库 HEAD 为 `ac40e50c165aa13a8c3cdc11f817141960f0b584`，受测 DR95／IR85、共同操作、Index Runtime 与 shared 五个工具目录及两份 skill 与初始 `f381715c0bfddd015503544c0fe38e8889809600` 字节相同。其他会话合入了生图／视频；不还原或修改它们。根 manifest／lock 有开发类型与视频脚本增量，实验采用实际安装依赖而非假定锁文件闭包。

`freeze.py` 对源码、生成文件和依赖实际逐文件采集 bytes／mode／SHA；原源、复制前后及最终副本相等。已存在的 optional `supports-color` 9.4.0 在正式采样前复制入隔离依赖，源与副本七文件一致。before／after 共享同份冻结依赖，原型只改变 envelope 密封实现；分发两份副本及维护源码使用同一转换。closure 专用八次 smoke 的 1,110 个实际文件 URL 全在冻结 before／after 内，baseline 起止已加载文件身份相等。完整路径清单不纳入资源，结果与 hash 在 provenance。

两域由形成时 compact recipe 重新生成各 10k 正式、9k 稀疏关系、2候选的 Git 仓库。DR 为 9k archived／1k active，IR 有一个正式 owner 小资源。fixture 无 remote、hooksPath=/dev/null，Git 系统／用户配置隔离；只有本轮自有临时 fixture 执行 init/add/commit/reset/clean。完整源投影与每 ID 长度前缀 SHA 指纹由独立 Python/PyYAML oracle 逐项验证。

矩阵固定为两域 × 两操作：

- `sync-index --select 261001-record-10000`：仅改所选 title，真实写完整工作区索引；必要前序依赖保持不变。
- `stage 261001-record-10000 --scope index`：工作区有已同步的所选 title；初始 pending 索引另有未选 ID 的不同 title／revision、已暂存未选正文和范围外 sentinel。必须只更新所选索引投影，保留 pending 未选投影、正文及范围外身份，W 最终状态全部不变。

未追加 all/domain：它们的正文吞吐与资源树不属于本轮最小问题；本轮不把 scope index 结果外推到那些分支。

## 正常与插桩分离

每场景三个正常 AB 对，固定顺序 before/after、after/before、before/after；恢复、完整输入 capture 与后验均在计时外。24正常后单独执行8个 probe（每场景before/after各1），并将其输出及完整效果与正常比较。8个 loader smoke 不进入正常分布，3个采集器自检另列。

每次为新 Node26.8.2完整CLI进程，清除继承 NODE_OPTIONS/NODE_PATH/覆盖率／编译缓存。Linux wait4 从启动前至退出回收记录 wall、user+system CPU及 ru_maxrss。CPU可能包含该口径已等待后代；RSS是该口径单进程高水位，不是进程树同时总量或JS heap。600s期限终止自己的进程组；本轮无产品超时、非预期退出或后验失败。额外采集器控验证0、7、信号-15及100001B stdout，未另测600s超时路径。

输入恢复／验后会预热缓存，不是冷缓存实验。正常输出最后落盘于2026-10-24 16:15:28–16:17:14 UTC；这是文件记录时间，不冒充精确采样启动时点。每次前后记录Node/Bun进程和cgroup cpu.stat/memory.current：第1对多场景观察到其他Bun，未干预、丢弃或补抽任何样本。未见Node/Bun不代表全机无活动；lifetime CPU%不是瞬时利用率，cgroup内存可含page cache，不当作进程heap。

## 计数与归因

独立 probe 副本对 parse/envelope/schema/normalize/build/canonicalize/serialize、领域完整图、stage准备／fresh／锁内pending复核／写后验收记录调用数及 inclusive wall、当前进程CPU。嵌套计时不能相加或当作全命令可分解占比；每个probe只有1次，噪声不能用计数消除。

复用历史已校验的 Node FS/Git observer，记录成功API返回字节（含FileHandle，去除嵌套重复）和真实 Git batch framing／payload；它不是syscall／物理磁盘量，也不包含Git内部文件I/O或Node loader内部全部读取。未知fd写入是stdout等观察边界，不能当作源读取。全部probe的observerUnknown为空。

stage捕获的5个blob经独立OID／完整字节／JSON身份后验绑定为固定HEAD索引1次、captured pending索引3次和最终pending索引1次；固定顺序及静态调用对应准备、fresh、锁内CAS、写后验收。不同阶段不是同一信任事实，不以OID相等省略实际字节门禁。

## 效果与正确性

每次独立 capture 完整 W bytes/mode、全部 P mode/OID/bytes、HEAD、正式正文与完整索引；AB 和正常/probe stdout/stderr SHA、完整 W/P 摘要、索引字节及命令返回后的最终文件／pending差异相等；这不证明全部瞬态写入或同字节改写，probe仅提供其覆盖内API写入证据。selected sync 再逐项验证全索引与来源指纹；stage独立组合 pending 基底＋所选W，检查所有未选pending身份与W不变。

小控比较两份源码的完整诊断、回调顺序与序列化：递归冻结、嵌套数组/对象、own `__proto__`／`constructor`、不合法schema／版本／成员／标量／JSON／非有限数。领域parser返回外部共享mutable对象时，后续归一化仍复制隔离，不冻结外部对象，后续外部修改不影响结果。这里没有实际注入并发漂移、I/O失败恢复或执行完整产品Gate。

`measurements.jsonl`的实验根路径仅展示归一为`<experiment-root>`；其数值和SHA未改。`results.json`保存全部正常min/median/max、每对比值、probe工作量与逐次阶段事件投影、控与payload身份；`methods.md`保存实际方法及必要节选。大型fixture、原始stdout/stderr和完整身份清单不是长期资源；临时区保留至root审计后精确清理。本材料便于独立阅读与复核，不声明已验证成一个脱离形成时环境的完整重放包。
