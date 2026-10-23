### Case DECISION-FUTURE-SCAFFOLD-LIFECYCLE-001: 未来关系不抹去候选结构而发布仍验闭合

Tests:
- `test:6f32984a04f4a02598326225f003e0309c4c46a836420165c81d92e357e9f59d`

Tags:
- `decision-records`

Contract:
- 候选 scaffold 只验关系语法，正式 publish 必须验证目标存在与最终闭合，bodyReady 不代替该证明。

Proves:
- 通过 API 创建指向未来完整 ID 的候选，补齐自身正文后 show-candidate 仍 scaffoldValid/bodyReady 为 true；publish preflight 因目标不存在而失败，来源原字节不变且不生成正式索引。
