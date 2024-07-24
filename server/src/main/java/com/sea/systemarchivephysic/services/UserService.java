package com.sea.systemarchivephysic.services;

import com.sea.systemarchivephysic.dtos.UserDto;
import com.sea.systemarchivephysic.models.AppUser;
import com.sea.systemarchivephysic.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    public List<AppUser> getAllUsers() {
        return userRepository.findAll();
    }

    public Optional<AppUser> getUserById(long id) {
        return userRepository.findById(id);
    }

    public AppUser saveUser(AppUser appUser) {
        return userRepository.save(appUser);
    }

    public void deleteUser(long id) {
        userRepository.deleteById(id);
    }

    public List<UserDto> lovUsers() {
        return userRepository.lovUsers();
    }
}
