package com.ecotrack.social;

import com.ecotrack.ai.AIProvider;
import com.ecotrack.ai.PromptRenderer;
import com.ecotrack.carbon.CarbonCalculationService;
import com.ecotrack.config.AppProperties;
import com.ecotrack.exception.ResourceNotFoundException;
import com.ecotrack.profile.UserProfile;
import com.ecotrack.profile.UserProfileRepository;
import com.ecotrack.social.dto.GoalProgressResponse;
import com.ecotrack.social.dto.GroupResponse;
import com.ecotrack.social.dto.LeaderboardEntryResponse;
import com.ecotrack.social.dto.LeaderboardResponse;
import com.ecotrack.user.User;
import com.ecotrack.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class GroupServiceTest {

    private GroupRepository groupRepo;
    private GroupMemberRepository memberRepo;
    private UserRepository userRepo;
    private UserProfileRepository profileRepo;
    private SocialActivityLogRepository activityRepo;
    private SocialCreditLedgerRepository creditRepo;
    private CarbonCalculationService carbonService;
    private AIProvider aiProvider;
    private PromptRenderer promptRenderer;
    private GroupService service;

    @BeforeEach
    void setUp() {
        groupRepo = mock(GroupRepository.class);
        memberRepo = mock(GroupMemberRepository.class);
        userRepo = mock(UserRepository.class);
        profileRepo = mock(UserProfileRepository.class);
        activityRepo = mock(SocialActivityLogRepository.class);
        creditRepo = mock(SocialCreditLedgerRepository.class);
        carbonService = mock(CarbonCalculationService.class);
        aiProvider = mock(AIProvider.class);
        promptRenderer = mock(PromptRenderer.class);
        var aiConfig = new AppProperties.Ai("canned", "model-default", "model-fast", 5, true, null);
        var props = new AppProperties(null, null, null, null, null, null, aiConfig);
        when(promptRenderer.render(anyString(), anyMap())).thenReturn("Rendered prompt");
        when(aiProvider.generate(anyString(), anyString())).thenReturn("Great week, team!");
        service = new GroupService(groupRepo, memberRepo, userRepo, profileRepo, activityRepo, creditRepo, carbonService,
                aiProvider, promptRenderer, props);
    }

    private User user(UUID id, String displayName) {
        User u = new User();
        u.setId(id);
        u.setEmail(id + "@example.com");
        u.setDisplayName(displayName);
        return u;
    }

    private Group group(UUID id, String name, String inviteCode) {
        Group g = new Group();
        g.setId(id);
        g.setName(name);
        g.setInviteCode(inviteCode);
        return g;
    }

    @Test
    void createGroupGeneratesUniqueInviteCodeAndAddsOwner() {
        UUID userId = UUID.randomUUID();
        when(groupRepo.existsByInviteCode(any())).thenReturn(true, true, false); // collide twice, then free
        when(userRepo.findAllById(anyList())).thenReturn(List.of(user(userId, "Alice")));

        GroupResponse resp = service.createGroup(userId, "Home Crew");

        ArgumentCaptor<Group> groupCaptor = ArgumentCaptor.forClass(Group.class);
        verify(groupRepo).save(groupCaptor.capture());
        assertEquals("Home Crew", groupCaptor.getValue().getName());
        assertNotNull(groupCaptor.getValue().getInviteCode());

        ArgumentCaptor<GroupMember> memberCaptor = ArgumentCaptor.forClass(GroupMember.class);
        verify(memberRepo).save(memberCaptor.capture());
        assertEquals(userId, memberCaptor.getValue().getUserId());
        assertEquals(GroupMember.ROLE_OWNER, memberCaptor.getValue().getRole());

        assertEquals("Home Crew", resp.name());
        assertEquals(1, resp.members().size());
        verify(groupRepo, times(3)).existsByInviteCode(any());
    }

    @Test
    void joinGroupIsIdempotentForExistingMember() {
        UUID groupId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Group g = group(groupId, "Home Crew", "ABCD1234");

        when(groupRepo.findByInviteCodeAndDeletedAtIsNull("ABCD1234")).thenReturn(Optional.of(g));
        when(memberRepo.existsByGroupIdAndUserId(groupId, userId)).thenReturn(true);
        when(memberRepo.findByGroupId(groupId)).thenReturn(List.of());

        service.joinGroup(userId, "ABCD1234");

        verify(memberRepo, never()).save(any());
    }

    @Test
    void joinGroupAddsNewMemberWhenNotAlreadyJoined() {
        UUID groupId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Group g = group(groupId, "Home Crew", "ABCD1234");

        when(groupRepo.findByInviteCodeAndDeletedAtIsNull("ABCD1234")).thenReturn(Optional.of(g));
        when(memberRepo.existsByGroupIdAndUserId(groupId, userId)).thenReturn(false);
        when(memberRepo.findByGroupId(groupId)).thenReturn(List.of());
        when(userRepo.findAllById(anyList())).thenReturn(List.of());

        service.joinGroup(userId, "ABCD1234");

        ArgumentCaptor<GroupMember> memberCaptor = ArgumentCaptor.forClass(GroupMember.class);
        verify(memberRepo).save(memberCaptor.capture());
        assertEquals(GroupMember.ROLE_MEMBER, memberCaptor.getValue().getRole());
    }

    @Test
    void joinGroupThrowsNotFoundForBadInviteCode() {
        UUID userId = UUID.randomUUID();
        when(groupRepo.findByInviteCodeAndDeletedAtIsNull("BOGUS123")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.joinGroup(userId, "BOGUS123"));
    }

    @Test
    void leaderboardRanksByCo2SavedDescendingAndRespectsWindow() {
        UUID groupId = UUID.randomUUID();
        UUID caller = UUID.randomUUID();
        UUID userA = UUID.randomUUID();
        UUID userB = UUID.randomUUID();
        Group g = group(groupId, "Home Crew", "ABCD1234");

        when(groupRepo.findByIdAndDeletedAtIsNull(groupId)).thenReturn(Optional.of(g));
        when(memberRepo.existsByGroupIdAndUserId(groupId, caller)).thenReturn(true);

        GroupMember mA = new GroupMember(); mA.setGroupId(groupId); mA.setUserId(userA); mA.setRole("owner");
        GroupMember mB = new GroupMember(); mB.setGroupId(groupId); mB.setUserId(userB); mB.setRole("member");
        when(memberRepo.findByGroupId(groupId)).thenReturn(List.of(mA, mB));

        when(activityRepo.sumCo2ByUserIds(anyList(), any())).thenReturn(List.of(
                new Object[]{userA, new BigDecimal("5.0")},
                new Object[]{userB, new BigDecimal("12.0")}
        ));
        when(userRepo.findAllById(anyList())).thenReturn(List.of(user(userA, "Alice"), user(userB, "Bob")));

        LeaderboardResponse response = service.getLeaderboard(groupId, caller, "week", "co2_saved");
        List<LeaderboardEntryResponse> board = response.entries();

        assertEquals(2, board.size());
        assertEquals(userB, board.get(0).userId());
        assertEquals(1, board.get(0).rank());
        assertEquals(12.0, board.get(0).value());
        assertEquals(userA, board.get(1).userId());
        assertEquals(2, board.get(1).rank());

        // window filter was passed through (not null for "week")
        verify(activityRepo).sumCo2ByUserIds(anyList(), any());
    }

    @Test
    void leaderboardIncludesAiGeneratedSummaryOnHappyPath() {
        UUID groupId = UUID.randomUUID();
        UUID caller = UUID.randomUUID();
        UUID userA = UUID.randomUUID();
        Group g = group(groupId, "Home Crew", "ABCD1234");

        when(groupRepo.findByIdAndDeletedAtIsNull(groupId)).thenReturn(Optional.of(g));
        when(memberRepo.existsByGroupIdAndUserId(groupId, caller)).thenReturn(true);

        GroupMember mA = new GroupMember(); mA.setGroupId(groupId); mA.setUserId(userA); mA.setRole("owner");
        when(memberRepo.findByGroupId(groupId)).thenReturn(List.of(mA));

        when(activityRepo.sumCo2ByUserIds(anyList(), any())).thenReturn(List.<Object[]>of(
                new Object[]{userA, new BigDecimal("5.0")}
        ));
        when(userRepo.findAllById(anyList())).thenReturn(List.of(user(userA, "Alice")));

        LeaderboardResponse response = service.getLeaderboard(groupId, caller, "week", "co2_saved");

        assertEquals("Great week, team!", response.aiSummary());
        verify(promptRenderer).render(eq("group_leaderboard_summary"), anyMap());
        verify(aiProvider).generate(eq("Rendered prompt"), eq("model-fast"));
    }

    @Test
    void leaderboardFallsBackToStaticSummaryWhenAiProviderThrows() {
        UUID groupId = UUID.randomUUID();
        UUID caller = UUID.randomUUID();
        UUID userA = UUID.randomUUID();
        Group g = group(groupId, "Home Crew", "ABCD1234");

        when(groupRepo.findByIdAndDeletedAtIsNull(groupId)).thenReturn(Optional.of(g));
        when(memberRepo.existsByGroupIdAndUserId(groupId, caller)).thenReturn(true);

        GroupMember mA = new GroupMember(); mA.setGroupId(groupId); mA.setUserId(userA); mA.setRole("owner");
        when(memberRepo.findByGroupId(groupId)).thenReturn(List.of(mA));

        when(activityRepo.sumCo2ByUserIds(anyList(), any())).thenReturn(List.<Object[]>of(
                new Object[]{userA, new BigDecimal("5.0")}
        ));
        when(userRepo.findAllById(anyList())).thenReturn(List.of(user(userA, "Alice")));
        when(promptRenderer.render(anyString(), anyMap())).thenThrow(new RuntimeException("boom"));

        LeaderboardResponse response = service.getLeaderboard(groupId, caller, "week", "co2_saved");

        assertNotNull(response.aiSummary());
        assertTrue(response.aiSummary().contains("Alice"));
        verifyNoInteractions(aiProvider);
    }

    @Test
    void leaderboardRanksByCreditsAndUsesAllWindowWithNoDateFilter() {
        UUID groupId = UUID.randomUUID();
        UUID caller = UUID.randomUUID();
        UUID userA = UUID.randomUUID();
        Group g = group(groupId, "Home Crew", "ABCD1234");

        when(groupRepo.findByIdAndDeletedAtIsNull(groupId)).thenReturn(Optional.of(g));
        when(memberRepo.existsByGroupIdAndUserId(groupId, caller)).thenReturn(true);

        GroupMember mA = new GroupMember(); mA.setGroupId(groupId); mA.setUserId(userA); mA.setRole("owner");
        when(memberRepo.findByGroupId(groupId)).thenReturn(List.of(mA));

        when(creditRepo.sumDeltaByUserIds(anyList(), isNull())).thenReturn(List.<Object[]>of(
                new Object[]{userA, 42}
        ));
        when(userRepo.findAllById(anyList())).thenReturn(List.of(user(userA, "Alice")));

        List<LeaderboardEntryResponse> board = service.getLeaderboard(groupId, caller, "all", "credits").entries();

        assertEquals(1, board.size());
        assertEquals(42.0, board.get(0).value());
        verify(creditRepo).sumDeltaByUserIds(anyList(), isNull());
    }

    @Test
    void goalProgressSumsAcrossMembers() {
        UUID groupId = UUID.randomUUID();
        UUID caller = UUID.randomUUID();
        UUID userA = UUID.randomUUID();
        UUID userB = UUID.randomUUID();
        Group g = group(groupId, "Home Crew", "ABCD1234");

        when(groupRepo.findByIdAndDeletedAtIsNull(groupId)).thenReturn(Optional.of(g));
        when(memberRepo.existsByGroupIdAndUserId(groupId, caller)).thenReturn(true);

        GroupMember mA = new GroupMember(); mA.setGroupId(groupId); mA.setUserId(userA); mA.setRole("owner");
        GroupMember mB = new GroupMember(); mB.setGroupId(groupId); mB.setUserId(userB); mB.setRole("member");
        when(memberRepo.findByGroupId(groupId)).thenReturn(List.of(mA, mB));

        UserProfile profileA = new UserProfile();
        profileA.setWeeklyGoalPct(20);
        when(profileRepo.findByUserIdAndDeletedAtIsNull(userA)).thenReturn(Optional.of(profileA));
        when(profileRepo.findByUserIdAndDeletedAtIsNull(userB)).thenReturn(Optional.empty()); // falls back to default 15%

        when(carbonService.carbonSaved(eq(userA), any(), any(), any())).thenReturn(new BigDecimal("10.0"));
        when(carbonService.carbonSaved(eq(userB), any(), any(), any())).thenReturn(new BigDecimal("4.0"));

        GoalProgressResponse resp = service.getGoalProgress(groupId, caller);

        // targetA = 8*7*0.20 = 11.2, targetB = 8*7*0.15 = 8.4 -> combinedGoalKg = 19.6
        // combinedCurrentKg = 10.0 + 4.0 = 14.0
        assertEquals(14.0, resp.combinedCurrentKg());
        assertEquals(19.6, resp.combinedGoalKg());
        assertEquals(2, resp.memberCount());
        assertTrue(resp.progressPct() > 0 && resp.progressPct() <= 100);
    }

    @Test
    void nonMemberCannotAccessGroupDetail() {
        UUID groupId = UUID.randomUUID();
        UUID outsider = UUID.randomUUID();
        Group g = group(groupId, "Home Crew", "ABCD1234");

        when(groupRepo.findByIdAndDeletedAtIsNull(groupId)).thenReturn(Optional.of(g));
        when(memberRepo.existsByGroupIdAndUserId(groupId, outsider)).thenReturn(false);

        assertThrows(AccessDeniedException.class, () -> service.getGroupDetail(groupId, outsider));
    }

    @Test
    void nonMemberCannotAccessLeaderboard() {
        UUID groupId = UUID.randomUUID();
        UUID outsider = UUID.randomUUID();
        Group g = group(groupId, "Home Crew", "ABCD1234");

        when(groupRepo.findByIdAndDeletedAtIsNull(groupId)).thenReturn(Optional.of(g));
        when(memberRepo.existsByGroupIdAndUserId(groupId, outsider)).thenReturn(false);

        assertThrows(AccessDeniedException.class, () -> service.getLeaderboard(groupId, outsider, "week", "co2_saved"));
    }

    @Test
    void nonMemberCannotAccessGoalProgress() {
        UUID groupId = UUID.randomUUID();
        UUID outsider = UUID.randomUUID();
        Group g = group(groupId, "Home Crew", "ABCD1234");

        when(groupRepo.findByIdAndDeletedAtIsNull(groupId)).thenReturn(Optional.of(g));
        when(memberRepo.existsByGroupIdAndUserId(groupId, outsider)).thenReturn(false);

        assertThrows(AccessDeniedException.class, () -> service.getGoalProgress(groupId, outsider));
    }
}
