package com.sea.systemarchivephysic.models;


import jakarta.persistence.*;

@Entity
public class Profile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long idProfile;
    private String roleName;

    public Profile() {}

    public void setIdProfile(long idProfile) {
        this.idProfile = idProfile;
    }

    public Profile(String roleName) {
        this.roleName = roleName;

    }

    public String getRoleName() {
        return roleName;
    }

    public void setRoleName(String roleName) {
        this.roleName = roleName;
    }
}
