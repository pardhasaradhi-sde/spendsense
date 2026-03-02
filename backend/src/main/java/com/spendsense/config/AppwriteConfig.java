package com.spendsense.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * Configures a RestTemplate pre-wired with Appwrite server authentication headers
 * (X-Appwrite-Project and X-Appwrite-Key) for all outgoing Appwrite Storage API calls.
 */
@Configuration
public class AppwriteConfig {

    @Value("${appwrite.project-id}")
    private String projectId;

    @Value("${appwrite.api-key}")
    private String apiKey;

    /**
     * A RestTemplate that automatically attaches Appwrite authentication headers
     * to every request. Injected into FileStorageService via @Qualifier.
     */
    @Bean("appwriteRestTemplate")
    public RestTemplate appwriteRestTemplate(RestTemplateBuilder builder) {
        return builder
                .additionalInterceptors((request, body, execution) -> {
                    request.getHeaders().set("X-Appwrite-Project", projectId);
                    request.getHeaders().set("X-Appwrite-Key", apiKey);
                    return execution.execute(request, body);
                })
                .build();
    }
}
