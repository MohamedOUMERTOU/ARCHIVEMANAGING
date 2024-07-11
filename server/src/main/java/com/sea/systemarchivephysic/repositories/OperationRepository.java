package com.sea.systemarchivephysic.repositories;

import com.sea.systemarchivephysic.models.Operation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OperationRepository extends JpaRepository<Operation, Integer> {
}