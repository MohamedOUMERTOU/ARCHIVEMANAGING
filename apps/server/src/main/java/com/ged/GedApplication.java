package com.ged;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
@ConfigurationPropertiesScan
// Les dépôts d'un même domaine sont regroupés dans une classe (ex. DocumentRepositories)
@EnableJpaRepositories(basePackages = "com.ged", considerNestedRepositories = true)
public class GedApplication {

    public static void main(String[] args) {
        SpringApplication.run(GedApplication.class, args);
    }
}
