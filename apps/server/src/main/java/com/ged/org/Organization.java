package com.ged.org;

import com.ged.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "organizations")
public class Organization extends BaseEntity {

    private String code;
    private String name;
    private boolean active = true;

    protected Organization() {}

    public Organization(String code, String name) {
        this.code = code;
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public boolean isActive() {
        return active;
    }
}
