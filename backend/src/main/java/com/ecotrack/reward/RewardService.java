package com.ecotrack.reward;

import com.ecotrack.credit.CreditService;
import com.ecotrack.exception.BadRequestException;
import com.ecotrack.exception.ResourceNotFoundException;
import com.ecotrack.reward.dto.RedemptionResponse;
import com.ecotrack.reward.dto.RewardResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class RewardService {

    private final RewardRepository rewardRepo;
    private final RedemptionRepository redemptionRepo;
    private final CreditService creditService;

    public RewardService(RewardRepository rewardRepo, RedemptionRepository redemptionRepo,
                          CreditService creditService) {
        this.rewardRepo = rewardRepo;
        this.redemptionRepo = redemptionRepo;
        this.creditService = creditService;
    }

    public List<RewardResponse> getCatalog() {
        return rewardRepo.findByActiveIsTrueAndDeletedAtIsNullOrderByTitleAsc().stream()
                .map(this::toRewardResponse).toList();
    }

    @Transactional
    public RedemptionResponse redeem(UUID userId, UUID rewardId) {
        Reward reward = rewardRepo.findById(rewardId)
                .orElseThrow(() -> new ResourceNotFoundException("Reward", "id", rewardId));

        if (!reward.isActive()) {
            throw new BadRequestException("This reward is no longer available");
        }

        // Check stock
        if (reward.getStock() != null && reward.getStock() <= 0) {
            throw new BadRequestException("This reward is out of stock");
        }

        // Debit credits atomically
        boolean success = creditService.debitCredits(userId, reward.getCostCredits(),
                "Redeemed: " + reward.getTitle(), "redemption", rewardId);
        if (!success) {
            throw new BadRequestException("Insufficient credits. Need " + reward.getCostCredits());
        }

        // Decrement stock
        if (reward.getStock() != null) {
            reward.setStock(reward.getStock() - 1);
            rewardRepo.save(reward);
        }

        // Create redemption
        Redemption r = new Redemption();
        r.setUserId(userId);
        r.setRewardId(rewardId);
        r.setCostCredits(reward.getCostCredits());
        r.setStatus("PENDING");
        redemptionRepo.save(r);

        return toRedemptionResponse(r, reward);
    }

    public List<RedemptionResponse> getRedemptions(UUID userId) {
        return redemptionRepo.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(r -> {
                    Reward reward = rewardRepo.findById(r.getRewardId()).orElse(null);
                    return toRedemptionResponse(r, reward);
                }).toList();
    }

    private RewardResponse toRewardResponse(Reward r) {
        return new RewardResponse(r.getId(), r.getRewardKey(), r.getTitle(), r.getDescription(),
                r.getCostCredits(), r.getStock(), r.getPartner(), r.getImageUrl());
    }

    private RedemptionResponse toRedemptionResponse(Redemption r, Reward reward) {
        return new RedemptionResponse(r.getId(), r.getRewardId(),
                reward != null ? reward.getTitle() : "Unknown",
                r.getCostCredits(), r.getStatus(),
                r.getCreatedAt() != null ? r.getCreatedAt().toString() : null);
    }
}
