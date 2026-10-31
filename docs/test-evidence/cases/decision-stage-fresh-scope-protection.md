### Case DECISION-STAGE-FRESH-SCOPE-PROTECTION-001: all scope 独立写前重读并保护 pending

Tests:
- `test:81d3bd01ae315fabdb7ac0b38c17441fbf783f462c7a20cc4d907f0439624698`

Tags:
- `decision-records`

Contract:
- all/domain 两次独立准备读取所选正文，index 两次核对发布投影；任何 scope 的相关输入或完整 pending 漂移都在 pending 写入前阻断。

Proves:
- 第二次所选正文读取时注入变更，命令返回 stage-source-changed，读取确为两次且 Git pending tree 保持原样。
