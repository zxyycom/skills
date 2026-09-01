### Case TEST-EVIDENCE-FIXED-CONTRACT-001: 项目级配置不参与测试账本接口
Entry:
- `tools/test-evidence/tests/catalog.test.ts > catalog ignores legacy config files and rejects config arguments`
- `bun test --test-name-pattern="^catalog ignores legacy config files and rejects config arguments$" ./tools/test-evidence/tests/catalog.test.ts`
Contract:
- 测试账本的目录、索引和 case ID 规则由固定协议决定，不接受项目级配置改写。
Proves:
- 遗留配置文件不能重定向查询；源码 CLI 入口以注入的当前目录解析相对 `--root .`，且对 `--config` 返回未知参数错误。
