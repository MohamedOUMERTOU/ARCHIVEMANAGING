package com.sea.systemarchivephysic.repositories;


import com.sea.systemarchivephysic.models.Document;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository extends JpaRepository<Document, Integer> {
}
