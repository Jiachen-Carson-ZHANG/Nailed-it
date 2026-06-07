# Phase 1 AI Review

This sheet is for human review of visible AI-generated copy in phase 1. Focus on whether the English output sounds salon-native, whether it stays short enough for UI surfaces, and whether the tone matches the Chinese source.

## Style Naming Output

| Field | Example zh-CN | Example en | Review Focus |
| --- | --- | --- | --- |
| recognizeStyleName.name | 奶油法式 | Creamy French | Must stay short, searchable, and style-like. |
| recognizeStyleName.description | 奶白底配细法式边，整体温柔干净。 | Soft milky base with a fine French edge and a clean, gentle finish. | Should describe color, finish, and overall vibe in one sentence. |
| recognizeStyleName.name.alt | 玫瑰猫眼 | Rose cat-eye | Confirm hyphenation and whether title case is desired in UI cards. |
| recognizeStyleName.description.alt | 玫瑰粉底色搭配柔和磁吸光带，整体像晚霞一样细闪。 | Rose-pink nails with a soft magnetic highlight that shimmers like sunset light. | Check whether metaphorical language is acceptable for merchant review surfaces. |

## Validation And Error Copy

| Field | Example zh-CN | Example en | Review Focus |
| --- | --- | --- | --- |
| nailValidation.invalidInput | 请上传一张美甲照片。 | Please upload a nail-style photo. | Representative first-wave validation copy from the plan example. |
| nailValidation.invalidInput.detail | 请上传一张能看清指甲的照片，或一张清晰的款式参考图。 | Please upload a clear nail photo or a clear style reference image. | Should guide recovery without sounding accusatory. |
| nailValidation.retryHint | 重新拍一张近一点、光线更稳定的照片，会更容易识别。 | Try a closer photo with steadier lighting for better recognition. | Keep actionable and concise. |

## Breakdown Summary Copy

| Field | Example zh-CN | Example en | Review Focus |
| --- | --- | --- | --- |
| breakdown.summary.confident | 已识别出主要款式元素，可继续查看报价。 | We found the main style elements, so you can continue to the quote. | Should feel trustworthy without overstating certainty. |
| breakdown.summary.review | 这组图片里有几项需要商家确认，我们会先保留为待确认项。 | A few details need merchant review, so we will keep them as pending items for now. | Ensure "pending items" maps cleanly to merchant workflow language. |
