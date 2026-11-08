# 共同记录操作模型

Decision Records 与 Investigation Report 保持各自领域语义、持久格式、skill 和分发；共同原生 CLI 在合作型本地单用户环境顺序处理操作。正文承载领域事实，索引是投影；pending 是下一次 Git 快照而非工作区备份。操作和授权从各自 skill 进入，机器结果与文件边界由[原生协议](../record-cli/protocol.md)承接。

## 操作与失败边界

预检只展示本次计划，不保存执行凭据；正式执行重新读取并准备一次。已有文件用库原子替换，新文件独占创建，但初始化失败可留下部分文件；多文件写入顺序进行，不承诺跨文件原子提交、CAS 或自动回滚。失败时依据实际 `changed`、`committed`、`writtenPaths`、`unknownPaths` 和诊断对账，未知不等于未写入。

stage 用 Git 的一次 index 更新合成所选内容并保留未选 pending，检查路径祖先与后代冲突，但不提供 HEAD/pending CAS 或并发隔离。各域领域约束和恢复步骤分别由对应 skill 的 CLI 及恢复参考承接；格式 Schema 由 `tools/record-contracts/` 承接。
