package com.sea.systemarchivephysic.models;

import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;

@Entity
public class Metadata {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long id;
    private String key;
    private String name;

    @ManyToMany
    @JoinTable(
            name = "operation_metadata",
            joinColumns = @JoinColumn(name = "metadata_id"),
            inverseJoinColumns = @JoinColumn(name = "operation_id")
    )
    private Set<Operation> operations = new HashSet<>();

    public Metadata() {}

    public Metadata(String key, String name) {
        this.key = key;
        this.name = name;
    }

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Set<Operation> getOperations() {
        return operations;
    }

    public void setOperations(Set<Operation> operations) {
        this.operations = operations;
    }
}
