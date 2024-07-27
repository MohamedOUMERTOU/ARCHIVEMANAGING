package com.sea.systemarchivephysic.services;

import com.sea.systemarchivephysic.models.RefTypedoc;
import com.sea.systemarchivephysic.repositories.RefTypedocRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class RefTypedocService {


    @Autowired
    private RefTypedocRepository refTypedocRepository;

    public List<RefTypedoc> getAllRefTypedocs() {
        return refTypedocRepository.findAll();
    }

    public Optional<RefTypedoc> getRefTypedocById(long id) {
        return refTypedocRepository.findById(id);
    }

    public RefTypedoc saveRefTypedoc(RefTypedoc refTypedoc) {
        return refTypedocRepository.save(refTypedoc);
    }

    public void deleteRefTypedoc(long id) {
        refTypedocRepository.deleteById(id);
    }
}