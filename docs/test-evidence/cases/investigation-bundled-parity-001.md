### Case INVESTIGATION-BUNDLED-PARITY-001: 调查写命令帮助与参数接线

Tests:
- `test:4c54b319cfd5f3f86ab21eb8099d63c88c1dd72f0996a55773184212f7ae8d17`

Tags:
- `investigation-report`

Contract:
- Investigation 写入命令帮助和参数解析应反映其领域支持的选项。

Proves:
- 真实程序的 publish help 公开多 selector 与 preflight、discard help 公开 delete-owned-resources；解析器接纳这些领域选项并拒绝 Decision 专属 alignment。
