package com.sea.systemarchivephysic.controllers;


import com.sea.systemarchivephysic.models.RefTypedoc;
import com.sea.systemarchivephysic.services.RefTypedocService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/typesDoc")
public class RefTypeDocController {
    @Autowired
    private RefTypedocService refTypeDocumentService;

    public List<RefTypedoc> getAllRefTypeDocuments() {
        return refTypeDocumentService.getAllRefTypedocs();
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createRefTypedoc(@RequestBody RefTypedoc refDoc) {
        Map<String, Object> response = new HashMap<>();
        try {
            RefTypedoc savedRefTypedoc = refTypeDocumentService.saveRefTypedoc(refDoc);
            response.put("message", "Type a été ajoutée avec succès!");
            response.put("success", true);
            response.put("data", savedRefTypedoc);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("message", "Error lors de création: " + e.getMessage());
            response.put("success", false);
            return ResponseEntity.status(500).body(response);
        }
    }
}
