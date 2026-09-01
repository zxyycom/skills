### Case TEST-EVIDENCE-TOPIC-MEMBERSHIP-001: 受控 Topic 可无 Case，但已存在目录不可为空
Entry:
- `tools/test-evidence/tests/catalog.test.ts > defined topics may be empty but existing topic directories may not`
- `bun test --test-name-pattern="^defined topics may be empty but existing topic directories may not$" ./tools/test-evidence/tests/catalog.test.ts`
Contract:
- 受控 topic 表可以预留暂时没有 case 的责任；一旦对应 topic 目录存在，该目录就必须包含单 case 文件。
Proves:
- 仅定义空 topic 时目录可同步并通过检查，显式创建空 topic 目录后返回可定位的 `catalog.topic-directory-empty`。
