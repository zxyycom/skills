# Permission Rules Maintenance

本文件承接本 skill 的第二个主要功能：维护 Codex shell 权限 rules。

只有用户明确要求添加、修改、审查权限 rules，或已经批准把问题升级为长期 rule 维护时读取。普通 shell 失败默认回到 `SKILL.md` 的失败后 shell 使用指挥，不把一次执行失败自动转成 rules 修改。

## 进入条件

1. 单次命令被 sandbox 拦住，但按当前环境规则提权即可完成：不改 rules。
2. 命令包含管道、脚本块、变量、重定向或通配符导致匹配不清：先按 shell 使用路径选择拆开或提权执行，不改 rules。
3. 同类只读命令反复被误判为 prompt/block，且参数边界稳定：可以提出补 allow 建议，等待用户确认后再改。
4. 命令能包住任意子命令、写入、删除、安装、下载、登录、启动服务或改配置：默认保留 prompt。
5. 用户要求长期调整权限行为，或明确批准维护 rules，才进入 rule 修改流程。

## rule 维护流程

1. 确认用户已经明确要求或批准维护 rules。
2. 收集原始命令和 runner 实际拆分后的命令片段。
3. 用 `codex execpolicy check --pretty --rules <rule-file> <command tokens...>` 检查最终 decision。
4. 多个 rule 文件要重复传 `--rules`，不要只检查单个文件。
5. 记录匹配到的规则、最终 decision 和预期 decision。
6. 如果 check 符合预期但真实 runner 不符合，检查当前会话是否热加载了最新 rules。
7. 修改后用同一命令 token 重新跑 `execpolicy check`，再决定是否真实执行。

## rule 文件注释

rule 文件可以使用空行、整行 `#` 注释和行尾 `#` 注释。整理较长 rule 文件时，可以用 `#` 分段说明规则组来源或用途。

不要使用 `//` 注释或 `/* ... */` 块注释；当前 `execpolicy check` 会把这些形态当成解析错误。

调整注释后仍要用 `codex execpolicy check --pretty --rules <rule-file> <command tokens...>` 跑一个代表性命令，确认注释没有影响 rule 文件解析。

## allow / prompt / block 边界

1. `allow`：只给无副作用、只读、参数边界稳定的命令。
2. `prompt`：给可能写入、联网、安装、启动服务、登录、改配置、删除、移动或包住任意命令的入口。
3. `block`：给不应执行、无法安全审批、或明显越界的命令形态。
4. 宽泛 `prompt` 可能让具体 `allow` 的最终 decision 仍是 `prompt`；以 `execpolicy check` 的最终 decision 为准。

## prefix_rule 设计

1. 前缀尽量短到能覆盖同类安全命令，但不能宽到覆盖任意执行入口。
2. 不为破坏性命令提供持久 `prefix_rule`。
3. 不为带重定向、变量展开、通配符或子表达式的动态命令设计宽泛 allow。
4. 对仓库维护脚本，可以按稳定入口设计 prompt 或已确认安全的 allow；写入型脚本默认更适合 prompt。

## 维护记录

修改或新增 rules 后，在对应项目文档或提交说明里记录：

1. 原始命令 token。
2. 修改前 decision。
3. 修改后 decision。
4. 为什么选择 allow、prompt 或 block。
5. 是否需要重启、热加载或重新打开会话。
