# Rename/discard 独立实现审查

审查基线：`66cf190967fd9ea7a0654412c29c955801951923`。本证据属于当前 Change 的短期验收材料；不修改产品、Plan、Case 或索引，不代表已执行完整 Gate 或性能基准。实现文件最终身份见本目录 `core-sha256.txt`；其文件内容 SHA-256 为 `77e215d0465a2ddad8f3ede33a787c7e938a5c05c6723579cb0f9aea2241412f`，覆盖 12 个本轮产品源码文件（含新增 transaction-plan）。

## 阶段义务与结论

| 阶段 | 保留的义务 | 当前实现判断 |
| --- | --- | --- |
| prepare | 严格来源、图、索引、身份；真实 namespace 的强 snapshot | DR workspace root、IR rename collection root、IR discard collection 父目录 root 分离；不改锚父链 |
| domain fresh | hook 后可变来源、目标/owner absence、成员与适用领域语义 | IR rename 来源/index 有序聚合通过本阶段安全观察；IR discard transaction fresh 的正文采集注入 phase，解析/图/资源继续执行；较早 hook 后对照不折叠 |
| shared pre | 全提案重复路径/权限、完整 before、guards | 结构及权限先判；writes/index/guards 统一队列；conflicting alias 不被去重抹平 |
| actual writes | 真实 handle 归属、独占目标、mode、提交点 | journal 未变判据由同一 owner 提供；只记录实际写入，index 保持原提交职责 |
| shared post | 实际 written 身份/mode/bytes 与未写保护 | 独立 phase，不借用 fresh；以 journal.written 而非 plan.next 猜测身份 |
| domain post | 适用新 layout、成员、图、索引、retired identity、owner copy | IR rename 完整 postverify 与 discard post collection 保留独立读取；不以 shared bytes 取代领域证明 |
| recovery/cleanup | 实际写集、CAS、winner、旧范围、精确 tombstone 清理 | 未改动资源 move/copy/delete/recovery 的独立时点证明；commit 后不回滚，状态不冒充未写 |

phase 缓存仅持有自己取得的 actual；领域取得 bytes、parents 数组及每个父身份对象的独立副本。失败、UTF-8 解码失败与缺失不生成成功 text 证明。不同 root 明确拒绝；同阶段完整 expected 不同会重新读取并比较，写后另建 phase。

计划归一化在跳过前核对所有提案，unchanged 来源成为 guard；不会遗漏 invalid permissions、canonical duplicate 或 conflicting guard。index 即使 unchanged 也保留 index 角色。candidate 的真实建立/旧位置退出顺序不变；IR changedPaths 不再把未写来源排除出成员保护。

## 剩余直接 I/O 分类

- **本轮最小共享接线**：writes/index/guards 队列；IR rename 来源/index fresh；IR discard publication fresh 正文采集；rename/discard 明确 fresh 的 resource sourceFiles。resource prepare 的给定文件列表安全 snapshot 采集也属相同最小读取队列职责，已反馈并完成窄改，独立 probe 验证首错与目录后序；prepare 与 fresh 仍各自实际读取。
- **保留独立时点**：resource move 前完整快照/源身份复核、每次复制前、删除前全树与逐文件 CAS、实际 handle/readback、recovery winner/CAS、tombstone cleanup。不能借旧 phase 抹掉副作用之间的读取。
- **保留领域扫描且不声称固有不可优化**：`scanResourceOwner` 的递归路径/类型/ID/目录/mode/hash 收集；严格 collection/layout/资源 owner 与 post-index 验证。它们混合领域选择及字节采集，后续可分离，但不是本次给定路径+完整 snapshot 的原样替换；本轮没有重构它们。
- **局部/兼容入口**：真正 no-op 的所选身份/文本/index 核对；单个缺失位置/目标或 index 捕获；candidate discard 的自身准备；DR 非 strict adapter 的 fallback 捕获。严格 rename/discard 的既有 prepare snapshot 已交接，不扩普通动作 scope。
- **恢复的旧范围验收**：恢复成员允许新 inode、未写成员仍要求旧完整身份，其比较不同于普通 phase 默认完整 identity；不能机械套同一个 batch 而放宽条件。

以上保留项不等同于性能瓶颈已消失；实际贡献由分阶段测量单独证明。

## 独立实证

从仓库根执行：

```text
node changes/align-record-rename-verification/evidence/review/fault-probes.mjs
node --test --test-name-pattern='preserves a changed target owner|preserves an old owner member|committed result when safe tombstone cleanup|restores report resources and index' tools/investigation-report/tests/rename-recovery.test.ts tools/investigation-report/tests/discard-recovery.test.ts
```

自写 probes 不是新增 `test:*` 保留测试入口；使用真实私有文件系统与实际产品 API，临时根带 `.review-owned` marker，finally 只删除自己创建的根。脚本与最后一次结果见 `fault-probes.mjs`、`fault-probes.log`；原生节点结果见 `resource-recovery.log`。

最终 8 个独立 probes 通过：canonical duplicate/unchanged 非法权限零写；深复制不可污染 phase、wrong root；1000 项队列 alias 冲突/有序聚合；真实 worker UTF-8/symlink/missing；normalized unchanged guard 的 postcommit inode winner；IR beforePublish source/index/target 并发改动的聚合与 winner 留存；resource 二进制、root、mode/inode/目录 mode 及后续无 phase 实时检查；prepare 资源队列 missing/mode 首错早于目录采集，且 1000 项真实 worker 批量保持二进制字节/mode。

另独立选择 4 个最小 Node 原生节点，4/4 通过：target owner 后改且 index 失败、旧 owner 新成员、discard committed cleanup-pending、discard index 失败恢复。没有运行大型 benchmark、全域测试或项目 Gate。

## 测试设计与证据边界

新增保留测试以 Node `test(...)` 为最小入口，文件是容器、spy/helper 是内部环节。shared normalizer、snapshot-copy/root、IR rename hook 聚合、discard fresh 采集与资源鲜度分别有独立行为意图；Case 与 index 由实现/主代理维护，不由本审查写入。

大规模真实 changed-set 长期原生测试仍由实现代理调整边界。已实测 1000 changed 成功数次属于当时端到端执行证据，不等于最终保留的 plan/batch 接线测试证明全量 journal 长期可靠，也不能把并发 runner 超时自动判为产品正确或错误。最终保留测试须清楚区分真实大 plan/shared pre-post batch 接线和小真实写入/恢复集成，不盲升 timeout；组合验收由主代理承担。discard 内部 publication fixture 明确保持 index 字节以隔离 fresh 采集，只证明该内部接线，不冒充公开删除投影正确性；公开链仍由既有测试承担。

最终核心复核未发现安全阻断；prepare 资源窄改已补充错误顺序/目录后序与 worker-sized binary probe。允许以该核心身份冻结 after 测量；测试调整、全量 Gate 和分阶段性能结论仍由主代理独立结算。若上述 12 个产品文件任一变化，须重新核对本证据身份与实际影响。

## 最后内部 export 增量复核

相对上一版 12 文件清单仅 `transaction.ts` 内容变化；从当前字节准确移除 `verifyPlan`、`verifyWritten` 定义前两个 `export ` 后，SHA-256 恢复为先前已审 `af118df2c5a7ee55dbaee27af2f54f471b26e864f8115c7d740a38e1e36e72b2`，证明函数体及调用点无其他变化。当前该文件 SHA-256 为 `e73246daf4dad5201536ee4a886d6575bf9f2474fd5727beae7590bf05e09547`。两域生成副本去掉约定生成头后与源码逐字节一致。

这两个符号只从内部 transaction 模块导出；领域 CLI 公开导出入口未新增它们，公开 API 声明源/生成 `.d.mts` 没有相关 diff，未发现公开 SDK 扩张。此纯 export 增量不重跑既有 8 probes。最后原生规模测试的降层与变异敏感性由主代理结算，本结论仅更新核心身份，不扩大过去执行证据的范围。
