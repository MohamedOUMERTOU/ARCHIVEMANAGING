package com.sea.systemarchivephysic.services;

import com.sea.systemarchivephysic.models.Operation;
import com.sea.systemarchivephysic.repositories.OperationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class OperationService {

    @Autowired
    private OperationRepository operationRepository;

    public List<Operation> getAllOperations() {
        return operationRepository.findAll();
    }

    public Optional<Operation> getOperationById(Integer id) {
        return operationRepository.findById(id);
    }

    public Operation saveOperation(Operation operation) {
        return operationRepository.save(operation);
    }

    public void deleteOperation(Integer id) {
        operationRepository.deleteById(id);
    }
}

