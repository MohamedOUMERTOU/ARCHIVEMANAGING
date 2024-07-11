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
    private Date date;
    private String name;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private AppUser appUser;

    private String description;
    private String destinataire;

    @ManyToMany(mappedBy = "operations")
    private Set<Document> documents = new HashSet<>();

    public Operation() {}

    public Operation(Set<Document> documents, String destinataire, String description, AppUser appUser, String name, Date date) {
        this.documents = documents;
        this.destinataire = destinataire;
        this.description = description;
        this.appUser = appUser;
        this.name = name;
        this.date = date;
    }

    public Set<Document> getDocuments() {
        return documents;
    }

    public void setIdOperation(long idOperation) {
        this.idOperation = idOperation;
    }

    public void setDocuments(Set<Document> documents) {
        this.documents = documents;
    }

    public String getDestinataire() {
        return destinataire;
    }

    public void setDestinataire(String destinataire) {
        this.destinataire = destinataire;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public AppUser getUser() {
        return appUser;
    }

    public void setUser(AppUser appUser) {
        this.appUser = appUser;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Date getDate() {
        return date;
    }

    public void setDate(Date date) {
        this.date = date;
    }
}
