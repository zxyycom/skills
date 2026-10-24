# 记录两域与 Task Graph / Test Evidence 阶段正确性复核

## 结论

在本轮静态审查范围内，**未发现需要阻断当前 Change 的实质正确性问题**。未修改测试或产品实现；本文件是本 Change 的短期审查产物，随 finalize 清理。

## 范围与依据

- 依据本 Change 的 proposal、design、findings、records-tests-handoff、graph-evidence-tests-handoff，以及审计 summary / review-tests 的最终收窄与撤回结论，核对 handoff 所属的记录两域／共同记录测试整改和 D 的 17 个测试文件当前 diff、保留节点及必要调用路径。
- 遵循 Test Design、Test Evidence Review 与 Case 账本契约；只判断本轮证明责任连续性和实质正确性，不进行风格整理、可选增强或全仓重新普查。
- 未审查其他会话新增的 source-frontmatter / owned-envelope 测试、产品实现及其生成物；Index Runtime 四个现有测试的正式复核由另一审查 owner 承接。正式 Case/index、长期文档和最终 Gate 是已知后续，不作为本阶段发现。

## 已核对的关键责任

- 共同十对无参数事务证明仅保留共同 owner 的一份后继；额外 verification / plan / text-snapshot 后继仍在，DR 与 IR 真实领域 adapter 各自保留。source / reader / 生成 CLI 的归位没有删去真实 worker、Node、umask 责任。
- DR 的真实 ID-keyed 删除检查、独立 UTC 日期预期、1001 条分页及过滤干扰仍有可区分观察；生命周期和索引维护拆分后保留原来的独立错误模型。
- 去掉图的语言内建私有探针后，保留结果、图引用复用、旧／新投影隔离及可用 provider seam 的零访问检查；删除精确总 batch 数没有连带删除实际 fresh、pending oid/mode/membership/deletion、必要 payload 故障和计算复用节点。
- IR 未选正式正文漂移改为正常 writer 的发布成功场景，符合 owner，不要求额外正文读取；所选候选、索引、资源身份拒绝仍有有效观察。恢复补强比较完整 bytes / mode，注入和屏障清理落在外层／finally。
- D 保留公开类型 consumer、API、schema、生成头与声明引用访问，移除的是私有文件名／export 拼写锁。serializer 有逆序输入；usage 矩阵下沉仍保留真实 Node 代表。TE 临时根登记与清理、native child 提前 completion 监听及 finally 等待闭合；1001、2 MiB、64 MiB、真实 Git／跨进程和既有深链规模未被削弱。

## 已排除的候选

`tools/investigation-report/tests/publish.test.ts` 的 indexDrift 节点仍在 writer 内使用 `assert.fail`，但不能据此复用旧 formalDrift 的“可被捕获并回滚空过”结论：hook 已真实修改索引，若 writer 被调用并拒绝，`RecordWriteJournal.observeRejectedWrite` 会将当前索引与旧 snapshot 的差异标记为 uncertainWrite / uncertainCommit；事务不会进入完整回滚成功路径，其 changed 和候选终态不能同时满足当前外层断言。selected candidate 节点另外检查具体 candidates changed 原因。故未把该候选列为缺陷，也不要求为它修改产品或增加重复测试。

## 验证边界

本轮只做静态 diff、节点后继和必要源码路径核对，**未运行测试、变异、生成、安装、Git 暂存／提交／推送或远端操作**。handoff 中既有运行记录不是本审查新取得的动态证据；本结论不替代后续 runner 实体／Case 覆盖、全局 Gate、Linux release 或 Windows 验收。
