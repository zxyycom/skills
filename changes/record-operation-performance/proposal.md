# Proposal

本 Change 在保留记录事务安全边界的前提下缩小 selected 同步的来源读取，并实测选择读取执行策略。

## Why

两域 selected sync 仍以完整来源扫描构建投影；IR 部分写入口锁外完整准备后又锁内重做。规模增长时产生与局部操作不相称的文件与解析成本。

## Outcome

DR/IR selected sync 只验证所选及必要依赖的当前来源，完整索引沿用合法发布基线；IR 正式执行不隐式运行锁外完整预演；有本轮可复核性能与安全回归证据。

## Scope

### Intended Change

仅调整 DR/IR selected sync、实际重复准备的 IR 操作入口及两域消费的读取策略。读取执行策略由同保证实验选择。

### Resulting Impacts

同步 CLI/skill 契约、测试 Case、决策、独立版本和生成产物；保持完整 sync/check、stage 和其他索引消费者的 scope。

## Success Criteria

- 所选和必要依赖安全、完整组合图、原生索引保护、fresh、写集归属与恢复仍成立。
- selected 成功不声称未选正文当前新鲜，不承诺发现未知位置身份及引用。
- 显式 preflight 完整只读无锁；正式执行仅轻量入口核对后进入锁内准备。
- 读取策略有串行 async、有界 async、独立 worker 同步批读的同保证对比。
- 原生测试、真实 Node 公共入口、独立分发及完整 changed gate 通过。

## Affected Owners

`tools/record-operations/`、`tools/decision-records/`、`tools/investigation-report/`；必要最窄 Index Runtime/shared；两域 skill 与引用契约、决策和测试账本。
