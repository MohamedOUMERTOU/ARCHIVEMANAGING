package com.sea.systemarchivephysic.repositories;

import com.sea.systemarchivephysic.models.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;


public interface UserRepository extends JpaRepository<AppUser, Long> {
}
