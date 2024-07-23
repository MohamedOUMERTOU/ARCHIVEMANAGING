package com.sea.systemarchivephysic.repositories;

import com.sea.systemarchivephysic.dtos.UserDto;
import com.sea.systemarchivephysic.models.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;


public interface UserRepository extends JpaRepository<AppUser, Long> {
    @Query("SELECT new com.sea.systemarchivephysic.dtos.UserDto(u.idUser, u.username) FROM AppUser u")
    List<UserDto> lovUsers();
}
