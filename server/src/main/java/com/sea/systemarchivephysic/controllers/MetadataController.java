package com.sea.systemarchivephysic.controllers;

import com.sea.systemarchivephysic.models.Menu;
import com.sea.systemarchivephysic.models.Metadata;
import com.sea.systemarchivephysic.models.Operation;
import com.sea.systemarchivephysic.services.MenuService;
import com.sea.systemarchivephysic.services.MetadataService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/metadata")
public class MetadataController {

    private final MetadataService metadataService;



    @Autowired
    public MetadataController(MetadataService metadataService) {
        this.metadataService = metadataService;
    }

    @GetMapping
    public List<Metadata> getAllMetadata() {
        return metadataService.getAllMetadata();
    }
    @GetMapping("/{id}")
    public ResponseEntity<Metadata> getMetadataById(@PathVariable Integer id) {
        Optional<Metadata> metadata = metadataService.getMetadataById(id);
        return metadata.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public Metadata saveMetadata(@RequestBody Metadata metadata) {
        return metadataService.saveMetadata(metadata);
    }
}
