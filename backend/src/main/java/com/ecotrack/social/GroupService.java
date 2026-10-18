package com.ecotrack.social;

import com.ecotrack.ai.AIProvider;
import com.ecotrack.ai.PromptRenderer;
import com.ecotrack.config.AppProperties;
import com.ecotrack.exception.BadRequestException;
import com.ecotrack.exception.ResourceNotFoundException;
import com.ecotrack.profile.UserProfile;
import com.ecotrack.profile.UserProfileRepository;
import com.ecotrack.social.dto.*;
import com.ecotrack.user.User;
import com.ecotrack.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Social layer service — household/friend groups, invite-code joining, and
 * group leaderboards / combined goal progress.
 */
@Service
public class GroupService {

    private static final Logger log = LoggerFactory.getLogger(GroupService.class);

    private static final String INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
    private static final int INVITE_CODE_LENGTH = 8;
    private static final int MAX_INVITE_CODE_ATTEMPTS = 10;

    /** Same fallback used by DashboardService for the "total saved" estimate when a user has no profile. */
    private static final BigDecimal FALLBACK_BASELINE_DAILY_KG = BigDecimal.valueOf(8.0);
    private static final int DEFAULT_WEEKLY_GOAL_PCT = 15; // matches the DB default on user_profiles.weekly_goal_pct

    private final GroupRepository groupRepo;
    private final GroupMemberRepository memberRepo;
    private final UserRepository userRepo;
    private final UserProfileRepository profileRepo;
    private final SocialActivityLogRepository activityRepo;
    private final SocialCreditLedgerRepository creditRepo;
    private final AIProvider aiProvider;
    private final PromptRenderer promptRenderer;
    private final AppProperties props;
    private final SecureRandom random = new SecureRandom();

    public GroupService(GroupRepository groupRepo,
                         GroupMemberRepository memberRepo,
                         UserRepository userRepo,
                         UserProfileRepository profileRepo,
                         SocialActivityLogRepository activityRepo,
                         SocialCreditLedgerRepository creditRepo,
                         AIProvider aiProvider,
                         PromptRenderer promptRenderer,
                         AppProperties props) {
        this.groupRepo = groupRepo;
        this.memberRepo = memberRepo;
        this.userRepo = userRepo;
        this.profileRepo = profileRepo;
        this.activityRepo = activityRepo;
        this.creditRepo = creditRepo;
        this.aiProvider = aiProvider;
        this.promptRenderer = promptRenderer;
        this.props = props;
    }

    @Transactional
    public GroupResponse createGroup(UUID userId, String name) {
        Group group = new Group();
        group.setName(name);
        group.setInviteCode(generateUniqueInviteCode());
        groupRepo.save(group);

        GroupMember owner = new GroupMember();
        owner.setGroupId(group.getId());
        owner.setUserId(userId);
        owner.setRole(GroupMember.ROLE_OWNER);
        memberRepo.save(owner);

        return toGroupResponse(group, List.of(owner));
    }

    /**
     * Joining is idempotent: if the caller is already a member, this is a
     * no-op that returns the current group state rather than erroring — a
     * double-tap on a join link (or opening it on two devices) shouldn't
     * surface a conflict to the user.
     */
    @Transactional
    public GroupResponse joinGroup(UUID userId, String inviteCode) {
        // Codes are generated upper-case; accept one typed or pasted in any case.
        String code = inviteCode.trim().toUpperCase(Locale.ROOT);
        Group group = groupRepo.findByInviteCodeAndDeletedAtIsNull(code)
                .orElseThrow(() -> new ResourceNotFoundException("Group", "inviteCode", code));

        if (!memberRepo.existsByGroupIdAndUserId(group.getId(), userId)) {
            GroupMember member = new GroupMember();
            member.setGroupId(group.getId());
            member.setUserId(userId);
            member.setRole(GroupMember.ROLE_MEMBER);
            memberRepo.save(member);
        }

        List<GroupMember> members = memberRepo.findByGroupId(group.getId());
        return toGroupResponse(group, members);
    }

    @Transactional(readOnly = true)
    public List<GroupSummaryResponse> getMyGroups(UUID userId) {
        List<GroupMember> memberships = memberRepo.findByUserId(userId);
        List<GroupSummaryResponse> result = new ArrayList<>();
        for (GroupMember m : memberships) {
            Group group = groupRepo.findByIdAndDeletedAtIsNull(m.getGroupId()).orElse(null);
            if (group == null) continue; // deleted/orphaned membership — skip defensively
            long memberCount = memberRepo.countByGroupId(group.getId());
            result.add(new GroupSummaryResponse(group.getId(), group.getName(), group.getInviteCode(), memberCount));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public GroupResponse getGroupDetail(UUID groupId, UUID userId) {
        Group group = requireGroup(groupId);
        requireMembership(group.getId(), userId);
        List<GroupMember> members = memberRepo.findByGroupId(group.getId());
        return toGroupResponse(group, members);
    }

    /**
     * @param window "week" (last 7 days incl. today), "month" (last 30 days incl. today), or "all" (no filter)
     * @param metric "co2_saved" (sum of activity_logs.co2_kg) or "credits" (sum of credit_ledger.delta)
     */
    @Transactional(readOnly = true)
    public LeaderboardResponse getLeaderboard(UUID groupId, UUID userId, String window, String metric) {
        Group group = requireGroup(groupId);
        requireMembership(group.getId(), userId);

        List<GroupMember> members = memberRepo.findByGroupId(group.getId());
        List<UUID> memberIds = members.stream().map(GroupMember::getUserId).toList();
        if (memberIds.isEmpty()) return new LeaderboardResponse(List.of(), null);

        Map<UUID, Double> totals = new HashMap<>();
        if ("credits".equalsIgnoreCase(metric)) {
            Instant from = creditWindowStart(window);
            for (Object[] row : creditRepo.sumDeltaByUserIds(memberIds, from)) {
                totals.put((UUID) row[0], ((Number) row[1]).doubleValue());
            }
        } else if ("co2_logged".equalsIgnoreCase(metric) || "co2_saved".equalsIgnoreCase(metric)) {
            // "co2_saved" is the historical name for this metric. It has always
            // been the sum of *logged emissions*, so it ranks lower-first.
            LocalDate from = co2WindowStart(window);
            for (Object[] row : activityRepo.sumCo2ByUserIds(memberIds, from)) {
                totals.put((UUID) row[0], ((Number) row[1]).doubleValue());
            }
        } else {
            throw new BadRequestException("Unknown leaderboard metric: " + metric);
        }

        Map<UUID, String> namesById = displayNamesById(memberIds);

        List<Map.Entry<UUID, Double>> ranked = memberIds.stream()
                .map(id -> Map.entry(id, totals.getOrDefault(id, 0.0)))
                .sorted(rankOrder(metric, totals))
                .collect(Collectors.toList());

        List<LeaderboardEntryResponse> result = new ArrayList<>();
        int rank = 1;
        for (Map.Entry<UUID, Double> entry : ranked) {
            result.add(new LeaderboardEntryResponse(
                    entry.getKey(), namesById.getOrDefault(entry.getKey(), "Member"), rank++, entry.getValue()));
        }

        // Nobody has anything in this window: there is no leader to praise.
        String aiSummary = totals.isEmpty() ? null
                : buildLeaderboardSummary(group.getName(), result, metric, window, memberIds.size());
        return new LeaderboardResponse(result, aiSummary);
    }

    /**
     * AI-generated short, encouraging summary sentence layered on top of the
     * deterministic ranking above — never the ranks/values themselves. Same
     * try/catch-and-static-fallback shape as
     * {@code EmbodiedCarbonService.buildAiSuggestion()}, so a Gemini outage
     * never blocks a leaderboard response.
     */
    private String buildLeaderboardSummary(String groupName, List<LeaderboardEntryResponse> ranked,
                                            String metric, String window, int memberCount) {
        if (ranked.isEmpty()) return null;
        LeaderboardEntryResponse top = ranked.get(0);
        try {
            String prompt = promptRenderer.render("group_leaderboard_summary", Map.of(
                    "group_name", groupName,
                    "top_performer", top.displayName(),
                    "top_value", String.valueOf(top.value()),
                    "metric", metric,
                    "window", window,
                    "member_count", String.valueOf(memberCount)
            ));
            return aiProvider.generate(prompt, props.ai().fastModel());
        } catch (Exception e) {
            log.warn("AI leaderboard-summary generation failed for group={}: {}", groupName, e.toString());
            return top.displayName() + " leads " + groupName + " this " + window + " with " + top.value() + " " + metric + ".";
        }
    }

    /**
     * Credits rank highest-first. Logged CO2 ranks lowest-first, and a member
     * with nothing logged in the window ranks last rather than "best" — an
     * empty log is missing data, not a zero footprint.
     */
    static Comparator<Map.Entry<UUID, Double>> rankOrder(String metric, Map<UUID, Double> totals) {
        if ("credits".equalsIgnoreCase(metric)) {
            return (a, b) -> Double.compare(b.getValue(), a.getValue());
        }
        return Comparator.<Map.Entry<UUID, Double>, Boolean>comparing(e -> !totals.containsKey(e.getKey()))
                .thenComparingDouble(Map.Entry::getValue);
    }

    /**
     * Combined weekly goal progress across all members.
     *
     * Formula per member:
     *  - week window = today.minusDays(6)..today — the same week-to-date range
     *    DashboardService uses for its weekly chart/aggregates.
     *  - baseline = 8.0 kg/day, the same fallback DashboardService uses.
     *  - actualSavedKg = baseline * (days the member logged anything) − what
     *    they logged, floored at 0. Only logged days count: a day with no logs
     *    is missing data, not a day of zero emissions (the same rule the
     *    leaderboard follows), so an inactive member adds no invented savings.
     *  - targetKg = (baseline * 7 days) * (member's weeklyGoalPct / 100), i.e.
     *    the member's personal reduction target expressed in kg for the week
     *    (weeklyGoalPct defaults to 15, matching the DB default).
     * The group's combined progress is simply the sum of actual vs. the sum of
     * target across all members.
     */
    @Transactional(readOnly = true)
    public GoalProgressResponse getGoalProgress(UUID groupId, UUID userId) {
        Group group = requireGroup(groupId);
        requireMembership(group.getId(), userId);

        List<GroupMember> members = memberRepo.findByGroupId(group.getId());
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.minusDays(6);

        Map<UUID, Object[]> loggedById = new HashMap<>();
        List<UUID> memberIds = members.stream().map(GroupMember::getUserId).toList();
        if (!memberIds.isEmpty()) {
            for (Object[] row : activityRepo.sumCo2AndLoggedDaysSince(memberIds, weekStart)) {
                loggedById.put((UUID) row[0], row);
            }
        }

        double combinedCurrentKg = 0;
        double combinedGoalKg = 0;
        for (GroupMember m : members) {
            UserProfile profile = profileRepo.findByUserIdAndDeletedAtIsNull(m.getUserId()).orElse(null);
            int weeklyGoalPct = (profile != null && profile.getWeeklyGoalPct() != null)
                    ? profile.getWeeklyGoalPct() : DEFAULT_WEEKLY_GOAL_PCT;

            Object[] logged = loggedById.get(m.getUserId());
            BigDecimal actualSaved = BigDecimal.ZERO;
            if (logged != null) {
                BigDecimal loggedKg = new BigDecimal(logged[1].toString());
                long loggedDays = ((Number) logged[2]).longValue();
                actualSaved = FALLBACK_BASELINE_DAILY_KG.multiply(BigDecimal.valueOf(loggedDays))
                        .subtract(loggedKg).max(BigDecimal.ZERO);
            }
            BigDecimal baselineWeekly = FALLBACK_BASELINE_DAILY_KG.multiply(BigDecimal.valueOf(7));
            BigDecimal targetKg = baselineWeekly.multiply(BigDecimal.valueOf(weeklyGoalPct)).divide(BigDecimal.valueOf(100));

            combinedCurrentKg += actualSaved.doubleValue();
            combinedGoalKg += targetKg.doubleValue();
        }

        double progressPct = combinedGoalKg > 0 ? Math.min(100.0, (combinedCurrentKg / combinedGoalKg) * 100.0) : 0.0;
        return new GoalProgressResponse(group.getId(), round1(combinedCurrentKg), round1(combinedGoalKg),
                round1(progressPct), members.size());
    }

    // --- helpers ---

    private Group requireGroup(UUID groupId) {
        return groupRepo.findByIdAndDeletedAtIsNull(groupId)
                .orElseThrow(() -> ResourceNotFoundException.of("Group", groupId));
    }

    private void requireMembership(UUID groupId, UUID userId) {
        if (!memberRepo.existsByGroupIdAndUserId(groupId, userId)) {
            throw new AccessDeniedException("Not a member of this group");
        }
    }

    private LocalDate co2WindowStart(String window) {
        LocalDate today = LocalDate.now();
        if ("week".equalsIgnoreCase(window)) return today.minusDays(6);
        if ("month".equalsIgnoreCase(window)) return today.minusDays(29);
        return null; // "all" — no lower bound
    }

    private Instant creditWindowStart(String window) {
        LocalDate from = co2WindowStart(window);
        return from == null ? null : from.atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    private Map<UUID, String> displayNamesById(List<UUID> userIds) {
        return userRepo.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, this::displayName));
    }

    private String displayName(User user) {
        return user.getDisplayName() != null && !user.getDisplayName().isBlank()
                ? user.getDisplayName() : user.getEmail();
    }

    private GroupResponse toGroupResponse(Group group, List<GroupMember> members) {
        Map<UUID, String> namesById = displayNamesById(members.stream().map(GroupMember::getUserId).toList());
        List<GroupMemberResponse> memberResponses = members.stream()
                .map(m -> new GroupMemberResponse(
                        m.getUserId(), namesById.getOrDefault(m.getUserId(), "Member"), m.getRole(),
                        m.getJoinedAt().toString()))
                .toList();
        return new GroupResponse(group.getId(), group.getName(), group.getInviteCode(),
                group.getCreatedByUserId(), memberResponses);
    }

    private String generateUniqueInviteCode() {
        for (int attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt++) {
            String code = randomInviteCode();
            if (!groupRepo.existsByInviteCode(code)) return code;
        }
        throw new IllegalStateException("Could not generate a unique invite code after "
                + MAX_INVITE_CODE_ATTEMPTS + " attempts");
    }

    private String randomInviteCode() {
        StringBuilder sb = new StringBuilder(INVITE_CODE_LENGTH);
        for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
            sb.append(INVITE_CODE_ALPHABET.charAt(random.nextInt(INVITE_CODE_ALPHABET.length())));
        }
        return sb.toString();
    }

    private double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
