package com.ecotrack.social;

import com.ecotrack.security.SecurityUtils;
import com.ecotrack.social.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/groups")
public class GroupController {

    private final GroupService service;

    public GroupController(GroupService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<GroupResponse> create(@Valid @RequestBody CreateGroupRequest req) {
        GroupResponse group = service.createGroup(SecurityUtils.currentUserId(), req.name());
        return ResponseEntity.status(HttpStatus.CREATED).body(group);
    }

    @PostMapping("/join")
    public ResponseEntity<GroupResponse> join(@Valid @RequestBody JoinGroupRequest req) {
        return ResponseEntity.ok(service.joinGroup(SecurityUtils.currentUserId(), req.inviteCode()));
    }

    @GetMapping("/mine")
    public ResponseEntity<List<GroupSummaryResponse>> mine() {
        return ResponseEntity.ok(service.getMyGroups(SecurityUtils.currentUserId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<GroupResponse> detail(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getGroupDetail(id, SecurityUtils.currentUserId()));
    }

    @GetMapping("/{id}/leaderboard")
    public ResponseEntity<List<LeaderboardEntryResponse>> leaderboard(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "week") String window,
            @RequestParam(defaultValue = "co2_saved") String metric) {
        return ResponseEntity.ok(service.getLeaderboard(id, SecurityUtils.currentUserId(), window, metric));
    }

    @GetMapping("/{id}/goal-progress")
    public ResponseEntity<GoalProgressResponse> goalProgress(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getGoalProgress(id, SecurityUtils.currentUserId()));
    }
}
