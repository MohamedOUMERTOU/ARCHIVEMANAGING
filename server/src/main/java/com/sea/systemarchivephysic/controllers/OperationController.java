package com.sea.systemarchivephysic.controllers;

import com.sea.systemarchivephysic.models.Operation;
import com.sea.systemarchivephysic.services.OperationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/operations")
public class OperationController {

    @Autowired
    private OperationService operationService;

    @GetMapping
    public List<Operation> getAllOperations() {
        return operationService.getAllOperations();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Operation> getOperationById(@PathVariable Integer id) {
        Optional<Operation> operation = operationService.getOperationById(id);
        return operation.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public Operation createOperation(@RequestBody Operation operation) {
        return operationService.saveOperation(operation);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Operation> updateOperation(@PathVariable Integer id, @RequestBody Operation operation) {
        if (!operationService.getOperationById(id).isPresent()) {
            return ResponseEntity.notFound().build();
        }
        operation.setIdOperation(id);
        Operation updatedOperation = operationService.saveOperation(operation);
        return ResponseEntity.ok(updatedOperation);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteOperation(@PathVariable Integer id) {
        if (!operationService.getOperationById(id).isPresent()) {
            return ResponseEntity.notFound().build();
        }
        operationService.deleteOperation(id);
        return ResponseEntity.noContent().build();
    }
}
