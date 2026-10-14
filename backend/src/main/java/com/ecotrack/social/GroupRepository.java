package com.ecotrack.social;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface GroupRepository extends JpaRepository<Group, UUID> {

    Optional<Group> findByInviteCodeAndDeletedAtIsNull(String inviteCode);

    Optional<Group> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsByInviteCode(String inviteCode);
}
