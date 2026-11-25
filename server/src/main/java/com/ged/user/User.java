package com.ged.user;

import com.ged.common.BaseEntity;
import com.ged.org.Organization;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
public class User extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id")
    private Organization organization;

    private String email;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "full_name")
    private String fullName;

    private boolean active = true;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "user_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id"))
    private Set<Role> roles = new HashSet<>();

    protected User() {}

    public User(Organization organization, String email, String passwordHash, String fullName, Set<Role> roles) {
        this.organization = organization;
        this.email = email.toLowerCase().trim();
        this.passwordHash = passwordHash;
        this.fullName = fullName;
        this.roles = new HashSet<>(roles);
    }

    public void update(String fullName, boolean active, Set<Role> roles) {
        this.fullName = fullName;
        this.active = active;
        this.roles = new HashSet<>(roles);
    }

    public void changePassword(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public Organization getOrganization() {
        return organization;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getFullName() {
        return fullName;
    }

    public boolean isActive() {
        return active;
    }

    public Set<Role> getRoles() {
        return roles;
    }
}
