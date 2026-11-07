### Case NATIVE-RECORD-MUTATION-PUBLISH-001: 候选发布的领域前提

Tests:
- `test:2c9a98bb9d49646756e035fbae39a3ec37b0c43b6c12471e85755364a0f32440`
- `test:3a349e12a834c125102c36d8acc13c5966e6e6d577f4bd4c6bf27e190f5c690c`
- `test:643add61f9c8010d3ff714dfb9aaa01538f50ab12c5a5ff160ab8c19e03a102d`
- `test:9109869a5094b2240c8b089cf150f7b372f9c15cbc75693355d687bba15b3242`
- `test:a86f87a0736f0fda446d75ccdbf73fe6f9529a1256f9de2be45ffe7f2aad2764`
- `test:a97daa69dcfb245f6db5388face050a73befaf5622b5ccf410ee091978e47452`
- `test:cb4a17035d1603e843cbb04854b86b91cee58e70f1b4816a343a2db5ad778388`

Tags:
- `record-rust`

Contract:
- 候选发布须验证目标关系及历史，不把未就绪或不可用历史误称可提交。

Proves:
- 选定候选、固定图和必要真实 Git 验证批量关系、历史确认、诊断及未写结果。
