package com.ged.storage;

import org.springframework.boot.health.contributor.AbstractHealthIndicator;
import org.springframework.boot.health.contributor.Health;
import org.springframework.stereotype.Component;

/** État du stockage dans /actuator/health (composant « storage »). */
@Component("storage")
public class StorageHealthIndicator extends AbstractHealthIndicator {

    private final FileStorage storage;

    public StorageHealthIndicator(FileStorage storage) {
        super("Stockage des fichiers injoignable");
        this.storage = storage;
    }

    @Override
    protected void doHealthCheck(Health.Builder builder) {
        storage.ping();
        builder.up().withDetail("type", storage.info().type()).withDetail("location", storage.info().location());
    }
}
