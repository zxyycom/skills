### Case GATE-RECORD-OPERATIONS-INPUTS-001: 共同记录操作变更激活真实消费者

Tests:
- `test:ffb34341894dd0fd382e8a8349a66f0486840849e3a731173214f7fcdb725f77`

Tags:
- `vibe-gate`

Contract:
- 共同记录操作是已知输入owner，变更需激活两域真实消费者而不扩大无关领域。

Proves:
- 共同query/sync/candidate源码与共同测试helper均保持incremental，激活DR/IR查询和维护，复用Index Runtime、Task Graph、Novel Cards独立测试；精确发布后warm无新增激活。
- 两域候选共同契约的原生适配入口分别激活所属维护检查，无未知输入；发布后 warm 无新增激活。
- DR 来源成员发现与三个事务边界测试归属维护、获取安全和同步锁测试归属查询，IR 事务文件实现归属维护；各路径保持 incremental、未知输入为空，只激活所属消费者并复用另一领域、Index Runtime、Task Graph 与 Novel Cards 的独立检查，精确发布后 warm 无新增激活。
- IR discard 恢复、rename 目录恢复原生测试及共享 rename 资源 fixture 分别变更时，均归属 IR 维护检查，保留未知输入为空、无关领域独立检查复用及精确发布后 warm 无新增激活的边界。
- 两域事务创建权限测试分别归属自身维护检查，保持 incremental、未知输入为空，另一领域及无关独立检查仍复用，精确发布后 warm 无新增激活。
- DR 严格准备测试、IR 严格准备源码与测试分别归属自身维护检查，保留 incremental、无未知输入、无关领域独立检查复用及精确发布后 warm 无新增激活的边界。
- DR 私有严格准备实现归属维护，公共验证实现归属基础记录能力并激活记录/check 消费者；两者均保留 incremental、无未知输入、跨领域独立检查复用及精确发布后 warm 无新增激活的边界。
- 两域 selected sync 领域适配器及局部契约测试分别归属自身查询能力，IR 执行入口契约测试归属维护；五条新路径均保持 incremental、未知输入为空，实际所属语义检查执行且其他领域与无关独立检查复用，精确发布后 warm 无新增激活。
- DR 局部身份、发布边界、历史基线、rename no-op 与 stage 测试子目录及 IR 局部发布源码和测试分别归属自身维护能力，DR 历史来源取证实现归属既有基础记录能力；逐路径变更保持 incremental、无未知输入，所属语义检查执行而另一领域与无关独立检查复用，精确发布后 warm 无新增激活。
