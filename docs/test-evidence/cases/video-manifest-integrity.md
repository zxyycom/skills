### Case VIDEO-MANIFEST-INTEGRITY-001: 清单身份一致性在全局边界验证

Tests:
- `test:4093ec4a5db769e3671a19a06cc9746391e219401cc737b43a2544a095e78cb9`
- `test:ed36995f81733f07aa0c63dcf671f79ae306d5ffce81c09e847123dc91192e70`

Tags:
- `video-understanding`

Contract:
- 清单请求、材料键、标识符与引用关系须有效；全局身份损坏与单个 payload 不可用具有不同影响。

Proves:
- 旧/非法结构、重复和悬空标识阻断清单读取；payload/index 不一致只标记相关材料不可用，诊断不泄露原始损坏内容。
