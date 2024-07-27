package com.sea.systemarchivephysic.models;

import jakarta.persistence.*;
import java.util.Date;
import java.util.HashSet;
import java.util.Set;

@Entity
public class Operation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long idOperation;
    private String name;
    private String description;

    @ManyToMany(mappedBy = "operations")
    private Set<Document> documents = new HashSet<>();
    @ManyToMany(mappedBy = "operations")
    private Set<Metadata> metadatas = new HashSet<>();

    public Operation() {}

    public Operation(Set<Document> documents, String description, String name) {
        this.documents = documents;
        this.description = description;
        this.name = name;

    }

    public long getIdOperation() {
        return idOperation;
    }

    public void setIdOperation(long idOperation) {
        this.idOperation = idOperation;
    }

    public Set<Document> getDocuments() {
        return documents;
    }

    public void setDocuments(Set<Document> documents) {
        this.documents = documents;
    }

    public Set<Metadata> getMetadatas() {
        return metadatas;
    }

    public void setMetadatas(Set<Metadata> metadatas) {
        this.metadatas = metadatas;
    }



    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

}
