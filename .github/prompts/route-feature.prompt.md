---
name: route-feature
description: Classify the feature, split it into task groups, and recommend the agent execution order.
---

Read the current Jira context and OpenSpec artifacts.

Output:

1. feature type: trivial | standard | fullstack | high-risk
2. task groups
3. recommended agent per task group
4. recommended execution order
5. places where human approval is mandatory
6. rollback-sensitive areas
