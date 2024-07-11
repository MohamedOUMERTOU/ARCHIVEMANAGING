package com.sea.systemarchivephysic.repositories;

import com.sea.systemarchivephysic.models.Profile;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProfileRepository  extends JpaRepository<Profile, Long> {
}
