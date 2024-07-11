package com.sea.systemarchivephysic.models;

import jakarta.persistence.*;



@Entity
public class Archive {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long id;
    private String dossier;
    private long idParent;
    private String description;

    public Archive(String description, long idParent, String dossier) {
        this.description = description;
        this.idParent = idParent;
        this.dossier = dossier;
    }

    public Archive() {}

    public void setId(long id) {
        this.id = id;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public long getIdParent() {
        return idParent;
    }

    public void setIdParent(long idParent) {
        this.idParent = idParent;
    }

    public String getDossier() {
        return dossier;
    }

    public void setDossier(String dossier) {
        this.dossier = dossier;
    }
}

