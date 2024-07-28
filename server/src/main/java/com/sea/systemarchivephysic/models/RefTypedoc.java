package com.sea.systemarchivephysic.models;

import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;

@Entity
public class RefTypedoc {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long id;
    @Column(unique = true)
    private String typeName;

    @OneToMany(mappedBy = "refTypedoc")
    private Set<Document> documents = new HashSet<>();

    public RefTypedoc() {}

    public RefTypedoc(String typeName) {
        this.typeName = typeName;
    }

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getTypeName() {
        return typeName;
    }

    public void setTypeName(String typeName) {
        this.typeName = typeName;
    }

    public Set<Document> getDocuments() {
        return documents;
    }

    public void setDocuments(Set<Document> documents) {
        this.documents = documents;
    }
}
