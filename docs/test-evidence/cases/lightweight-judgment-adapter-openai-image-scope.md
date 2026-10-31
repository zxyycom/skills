### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-007: OpenAI 图像作用域与容量门禁

Tests:
- `test:3f0612feba31c6a2601b2ccbdffb781d3a94eab30e44437f5977aada1ead7d5b`

Tags:
- `lightweight-judgment`

Contract:
- 直接 `openai-decisions` 的原生数组合同只将 state 图片按路径关联到 user 图文输入；不提升题目局部图、拆分、多发或降级 Box。

Proves:
- 两次图片 occurrence 保留相同像素数据和独立路径；128 张通过、129 张拒绝，局部图、Box、单候选、201 题及编译后超长题意均 attempts=0。
