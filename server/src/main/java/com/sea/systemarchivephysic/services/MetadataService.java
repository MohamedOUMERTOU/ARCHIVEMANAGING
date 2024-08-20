package com.sea.systemarchivephysic.services;
import com.sea.systemarchivephysic.models.Metadata;
import com.sea.systemarchivephysic.models.Operation;
import com.sea.systemarchivephysic.repositories.MetadataRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class MetadataService {
    @Autowired
    private MetadataRepository metadataRepository;
    public List<Metadata> getAllMetadata() {
        return metadataRepository.findAll();
    }
public Optional<Metadata> getMetadataById(long id) {
        return   metadataRepository.findById(id);
}

public  Metadata saveMetadata(Metadata metadata) {
        return metadataRepository.save(metadata);
    }

    public void deleteMetadata(long id) {
        metadataRepository.deleteById(id);
    }
}
