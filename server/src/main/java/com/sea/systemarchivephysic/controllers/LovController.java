package com.sea.systemarchivephysic.controllers;

import com.sea.systemarchivephysic.dtos.UserDto;
import com.sea.systemarchivephysic.models.AppUser;
import com.sea.systemarchivephysic.services.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/lov/")
public class LovController {

    @Autowired
    private UserService userService;

    @GetMapping("users")
    public List<UserDto> getUserLov() {
        return userService.lovUsers();
    }
}

