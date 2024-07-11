package com.sea.systemarchivephysic.repositories;

import com.sea.systemarchivephysic.models.Archive;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ArchiveRepository extends JpaRepository<Archive, Integer> {
}
