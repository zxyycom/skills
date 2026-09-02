# Diagnostics Matrix

本矩阵把本 Change 已知的用户可见诊断收敛为可审计类别；实施时用它核对 producer、renderer、字段和测试，不能将它当作源码调用点、测试证据或持久日志的第二 owner。

| 类别 | 主要 owner | 必需字段 | 可选字段 | 输出 | 测试策略 |
| --- | --- | --- | --- | --- | --- |
| 参数、内容与领域语义 | 两套领域 CLI/validation | `code`、对象、原因、下一步 | 字段/文件位置、领域 ID | 最终 CLI 即时 stderr；保留既有参数/领域退出码 | 单元覆盖非法输入、来源与关系；CLI 断言必要段落 |
| 读取、查询与索引基线 | 两套领域 query/index、index-runtime | `code`、对象、原因、下一步 | operation、target、`causeCategory`、受控 detail | 最终 CLI 即时 stderr；无 mutation 字段 | fake source/index 与受控 Git 失败；字段断言 |
| Git 发现、revision 与命令 | shared version-control，领域映射 | `code`、对象、原因、下一步 | operation、target、`causeCategory`、受控 detail | shared 保留事实，领域/CLI 输出即时 stderr；无稳定机器信号的仓库策略文本保留为 `command-failed` 或 `unknown`，不单列 `repository-policy` | adapter/child-process 注入：ENOENT、非仓库、revision、普通或不具稳定信号的策略 stderr、unknown |
| 锁与并发冲突 | shared pending、两套 collection lock | `code`、对象、原因、下一步 | target、`causeCategory: busy`、受控 detail | 即时 stderr；只在确认的 `EEXIST`/冲突时称 busy | `EEXIST` 与 EACCES/未知 I/O 对照；不自动删锁 |
| 非阻断历史检查 | Investigation relation/history | `code`、对象、原因、下一步 | operation、target、`causeCategory`、detail | 明确“检查未完成”的 warning 写 stderr，成功命令退出码不变 | Git 不可用时不返回空/无 warning；正常 warning 回归 |
| mutation 前失败与完整回滚 | 各领域事务、index-runtime staging | `code`、对象、原因、下一步、scope、`outcome` | operation、target、cause/detail、领域 ID | 最终 CLI 即时 stderr；`no-change` 或 `rolled-back` | 写入前失败、写后恢复成功；断言事务范围与字段 |
| mutation 恢复不完整或提交后清理 | 各领域事务、index-runtime staging | `code`、对象、原因、下一步、scope、`outcome` | operation、target、cause/detail、领域 ID | 最终 CLI 即时 stderr；诚实报告 `partial-or-unknown` 或 `committed-cleanup-pending` | 注入恢复失败与提交后清理失败；禁止扩大 scope |
| 权限与 detail 安全 | shared 净化、领域 renderer | `code`、对象、原因、下一步 | `causeCategory: access-denied`、受控 detail | 即时 stderr；不建议 `sudo` | EACCES/EPERM 注入；换行、长度、路径和敏感模式测试 |

规则：普通类别不得伪造 `scope/outcome`；只有后两类 mutation 行由事务 owner 填写。所有类别保持成功 stdout、失败/warning stderr 和既有退出码语义；无任何诊断持久化。
