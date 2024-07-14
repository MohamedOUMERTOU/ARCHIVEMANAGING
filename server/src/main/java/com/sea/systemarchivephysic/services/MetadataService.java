package com.sea.systemarchivephysic.services;
import com.sea.systemarchivephysic.models.Metadata;
import com.sea.systemarchivephysic.repositories.MetadataRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
@Service
public class MetadataService {
    @Autowired
    private MetadataRepository metadataRepository;
    public List<Metadata> getAllMetadata() {
        return metadataRepository.findAll();
    }

}
