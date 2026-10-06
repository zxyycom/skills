### Case NOVEL-CARDS-SHARED-FRONTIER-013: 共享下级准确边界

Tests:
- `test:07a52654846a33e475f9743ae969bfc28a96a7a8e1ff080541f92526cd4b08b8`

Tags:
- `novel-cards`

Contract:
- frontier只承接此次未返回的卡；通过其他children路径返回的同一ID不再算未读。

Proves:
- 共享下级在depth与max-cards预算内全返回时complete为真；共享下级另有未读孩子时仅保留真实边界。
