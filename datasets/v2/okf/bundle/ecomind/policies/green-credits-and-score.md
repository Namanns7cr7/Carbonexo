---
type: Verification Policy
title: Carbonexo green credits and Credit Score
description: What Carbonexo green credits and the Carbon Credit Score are, where their values come from, and what the coach may and may not claim about them.
tags: [policy, green-credits, rewards, score]
status: draft
generated: {by: claude-code/claude-opus-5-5, at: '2026-10-18T11:36:00Z'}
stale_after: '2027-04-18T00:00:00Z'
sources:
- {id: carbonexo-credit-engine, resource: backend/src/main/java/com/ecotrack/credit/CreditService.java and score/CreditScoreService.java in the Carbonexo repository, title: Carbonexo credit engine and score service (product source of truth)}
carbonexo:
  rule_id: policy.green_credits
  enforced_by: [getGreenCreditBalance, getCarbonCreditScore, getGreenCreditRules]
  internal_review_status: pending_human_review
---

# Green credits

Carbonexo green credits are reward points recorded in the user's credit ledger. They are earned under the active rules in the credit rule table (for example a welcome bonus, completing a plan action, a tracking streak or confirming an electricity bill). Rules and amounts can change, so the coach reads them with getGreenCreditRules and never states them from memory.

A user's balance is the sum of their ledger entries. The coach reads it with getGreenCreditBalance for the signed-in user only.

# What green credits are not

Green credits are not carbon credits or offsets. They are not issued by a crediting programme, do not represent verified tonnes of CO2e reduced, and cannot be sold, transferred or traded. Earning credits does not mean an emission reduction was measured or verified.

# Redeeming

Green credits can be redeemed only for items in the Carbonexo rewards catalogue, on the Rewards page. The coach lists catalogue items and their costs from getGreenCreditRules and does not redeem on the user's behalf. Partner fulfilment claims in catalogue descriptions are the partner's, not verified by the coach.

# Carbon Credit Score

The Carbon Credit Score is an in-app engagement score on a 300 to 850 scale computed by the score service from three inputs: the green-credit balance, the current tracking streak and the number of distinct days with logged activity in the last 30 days. Each input contributes up to a cap and the score has a tier name. The coach reads the score, its components and caps with getCarbonCreditScore.

To improve the score a user raises whichever components are below their caps: earn green credits, log on consecutive days and log on more days in the month.

Score history is not stored, so the coach cannot say exactly why a score changed between two dates. It can explain the current components and which inputs move them.
