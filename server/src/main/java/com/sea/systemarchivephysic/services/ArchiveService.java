package com.sea.systemarchivephysic.services;

import com.sea.systemarchivephysic.models.Archive;
import com.sea.systemarchivephysic.repositories.ArchiveRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class ArchiveService {

    @Autowired
    private ArchiveRepository archiveRepository;

    public List<Archive> getAllArchives() {
        return archiveRepository.findAll();
    }

    public Optional<Archive> getArchiveById(Integer id) {
        return archiveRepository.findById(id);
    }

    public Archive saveArchive(Archive archive) {
        return archiveRepository.save(archive);
    }

    public void deleteArchive(Integer id) {
        archiveRepository.deleteById(id);
    }
}
