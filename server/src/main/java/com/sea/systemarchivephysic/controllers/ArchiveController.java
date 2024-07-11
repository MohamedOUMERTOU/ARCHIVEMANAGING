package com.sea.systemarchivephysic.controllers;

import com.sea.systemarchivephysic.models.Archive;
import com.sea.systemarchivephysic.services.ArchiveService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/archives")
public class ArchiveController {

    @Autowired
    private ArchiveService archiveService;

    @GetMapping
    public List<Archive> getAllArchives() {
        return archiveService.getAllArchives();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Archive> getArchiveById(@PathVariable Integer id) {
        Optional<Archive> archive = archiveService.getArchiveById(id);
        return archive.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public Archive createArchive(@RequestBody Archive archive) {
        return archiveService.saveArchive(archive);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Archive> updateArchive(@PathVariable Integer id, @RequestBody Archive archive) {
        if (!archiveService.getArchiveById(id).isPresent()) {
            return ResponseEntity.notFound().build();
        }
        archive.setId(id);
        Archive updatedArchive = archiveService.saveArchive(archive);
        return ResponseEntity.ok(updatedArchive);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteArchive(@PathVariable Integer id) {
        if (!archiveService.getArchiveById(id).isPresent()) {
            return ResponseEntity.notFound().build();
        }
        archiveService.deleteArchive(id);
        return ResponseEntity.noContent().build();
    }
}
