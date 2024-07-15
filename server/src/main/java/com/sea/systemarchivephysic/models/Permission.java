package com.sea.systemarchivephysic.models;

import jakarta.persistence.*;
import java.util.Set;

@Entity
@Table(name = "permission")
public class Permission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_permission")
    private long idPermission;

    private String name;

    private String description;

    @ManyToMany(mappedBy = "permissions")
    private Set<AppUser> users;

    public Permission() {
    }

    public Permission(String name, String description) {
        this.name = name;
        this.description = description;
    }

    public long getIdPermission() {
        return idPermission;
    }

    public void setIdPermission(long idPermission) {
        this.idPermission = idPermission;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Set<AppUser> getUsers() {
        return users;
    }

    public void setUsers(Set<AppUser> users) {
        this.users = users;
    }
}
