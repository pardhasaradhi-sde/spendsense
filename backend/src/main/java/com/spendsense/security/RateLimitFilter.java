package com.spendsense.security;

import com.spendsense.config.RateLimitConfig;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private final RateLimitConfig rateLimitConfig;

    @Value("${rate-limit.enabled:true}")
    private boolean rateLimitEnabled;

    @Value("${app.trust-x-forwarded-for:false}")
    private boolean trustXForwardedFor;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {

        // If rate limiting is disabled globally, skip entirely
        if (!rateLimitEnabled) {
            chain.doFilter(request, response);
            return;
        }

        String uri = request.getRequestURI();
        // Skip health check and webhook endpoints
        if (uri.equals("/api/v1/actuator/health") || uri.startsWith("/api/v1/webhooks")) {
            chain.doFilter(request, response);
            return;
        }

        String clientId = getClientIdentifier(request);
        Bucket bucket = rateLimitConfig.resolveBucket(clientId);
        if (bucket.tryConsume(1)) {
            response.setHeader("X-RateLimit-Remaining",
                    String.valueOf(bucket.getAvailableTokens()));
            chain.doFilter(request, response);
        } else {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.getWriter().write(
                    "{\"error\":\"Too Many Requests\",\"message\":\"Rate limit exceeded. Try again later.\"}");
        }
    }

    private String getClientIdentifier(HttpServletRequest request) {
        if (trustXForwardedFor) {
            String ip = request.getHeader("X-Forwarded-For");
            if (ip != null && !ip.isEmpty()) {
                // Use only the first IP (original client) in the forwarded chain
                if (ip.contains(",")) {
                    ip = ip.split(",")[0].trim();
                }
                return "ip:" + ip;
            }
        }
        return "ip:" + request.getRemoteAddr();
    }
}
