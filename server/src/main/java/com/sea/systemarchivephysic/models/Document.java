package com.sea.systemarchivephysic.models;

import jakarta.persistence.*;
import java.util.Date;
import java.util.HashSet;
import java.util.Set;

@Entity
public class Document {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long idDoc;
    private String name;
    private String description;
    private String source;
    private Date date;
    private String status;

    @ManyToMany
    @JoinTable(
            name = "ref_docu_operation",
            joinColumns = @JoinColumn(name = "document_id"),
            inverseJoinColumns = @JoinColumn(name = "operation_id")
    )
    private Set<Operation> operations = new HashSet<>();

    @ManyToOne
    @JoinColumn(name = "type_id")
    private RefTypedoc refTypedoc;

    public Document() {}

    public Document(String name, String description, String source, Date date, String status, Set<Operation> operations, RefTypedoc refTypedoc) {
        this.name = name;
        this.description = description;
        this.source = source;
        this.date = date;
        this.status = status;
        this.operations = operations;
        this.refTypedoc = refTypedoc;
    }

    public long getIdDoc() {
        return idDoc;
    }

    public void setIdDoc(long idDoc) {
        this.idDoc = idDoc;
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

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public Date getDate() {
        return date;
    }

    public void setDate(Date date) {
        this.date = date;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Set<Operation> getOperations() {
        return operations;
    }

    public void setOperations(Set<Operation> operations) {
        this.operations = operations;
    }

    public RefTypedoc getRefTypedoc() {
        return refTypedoc;
    }

    public void setRefTypedoc(RefTypedoc refTypedoc) {
        this.refTypedoc = refTypedoc;
    }
}
