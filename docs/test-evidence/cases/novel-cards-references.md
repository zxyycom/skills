### Case NOVEL-CARDS-REFERENCES-003: 所有受管引用校验

Tests:
- `test:9b4cb94c3532f889b93775759ac8b95ec107f87d0b802715ef36a171f96958e7`

Tags:
- `novel-cards`

Contract:
- children、sources、refs、显式card链接、state_at及关系目标必须实际存在，位置锚点与关系目标有域要求。

Proves:
- 悬空引用逐种被拒绝，非剧情状态锚点与非人物关系目标分别失败；空白、非法字符与路径形式的括号目标失败，正常及代码中的实际ID被提取，自然语言、wiki与普通URL不作为受管引用。
