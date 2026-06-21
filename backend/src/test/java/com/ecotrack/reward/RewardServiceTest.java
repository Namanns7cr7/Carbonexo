package com.ecotrack.reward;

import com.ecotrack.credit.CreditService;
import com.ecotrack.exception.BadRequestException;
import com.ecotrack.exception.ResourceNotFoundException;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RewardServiceTest {

    private final RewardRepository rewardRepo = mock(RewardRepository.class);
    private final RedemptionRepository redemptionRepo = mock(RedemptionRepository.class);
    private final CreditService credits = mock(CreditService.class);
    private final RewardService svc = new RewardService(rewardRepo, redemptionRepo, credits);

    private final UUID user = UUID.randomUUID();
    private final UUID rewardId = UUID.randomUUID();

    private Reward reward(int cost, Integer stock, boolean active) {
        Reward r = mock(Reward.class);
        when(r.getCostCredits()).thenReturn(cost);
        when(r.getStock()).thenReturn(stock);
        when(r.isActive()).thenReturn(active);
        when(r.getTitle()).thenReturn("Eco Tote");
        return r;
    }

    @Test
    void redeemThrowsWhenRewardMissing() {
        when(rewardRepo.findById(rewardId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> svc.redeem(user, rewardId));
    }

    @Test
    void redeemThrowsWhenOutOfStock() {
        Reward r = reward(100, 0, true);
        when(rewardRepo.findById(rewardId)).thenReturn(Optional.of(r));
        assertThrows(BadRequestException.class, () -> svc.redeem(user, rewardId));
        verify(credits, never()).debitCredits(any(), anyInt(), anyString(), anyString(), any());
    }

    @Test
    void redeemThrowsWhenInsufficientCredits() {
        Reward r = reward(500, 5, true);
        when(rewardRepo.findById(rewardId)).thenReturn(Optional.of(r));
        when(credits.debitCredits(eq(user), eq(500), anyString(), anyString(), any())).thenReturn(false);

        assertThrows(BadRequestException.class, () -> svc.redeem(user, rewardId));
        verify(redemptionRepo, never()).save(any());
    }

    @Test
    void redeemSucceedsDebitsAndRecordsRedemption() {
        Reward r = reward(100, 5, true);
        when(rewardRepo.findById(rewardId)).thenReturn(Optional.of(r));
        when(credits.debitCredits(eq(user), eq(100), anyString(), anyString(), any())).thenReturn(true);

        var resp = svc.redeem(user, rewardId);

        assertNotNull(resp);
        verify(credits).debitCredits(eq(user), eq(100), anyString(), eq("redemption"), eq(rewardId));
        verify(redemptionRepo).save(any(Redemption.class));
    }
}
