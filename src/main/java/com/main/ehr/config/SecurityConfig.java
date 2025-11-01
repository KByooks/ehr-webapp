package com.main.ehr.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * EHR Application Security Configuration
 *
 * Goals:
 *  - Maintain authentication & role-based access
 *  - Allow internal same-origin iframes for embedded modals
 *  - Keep configuration scalable and clean for future modules (billing, reports, etc.)
 */
@Configuration
public class SecurityConfig {

    // --- Password Encoder (Reusable across services) ---
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // --- Main Security Filter Chain ---
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // Disable CSRF only for REST APIs (recommended for modern SPAs/JSON APIs)
            .csrf(csrf -> csrf.disable())

            // --- Authorization Rules ---
            .authorizeHttpRequests(auth -> auth
                // API access by role
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/staff/**").hasAnyRole("ADMIN", "STAFF")

                // Public resources (static assets, login, fragments)
                .requestMatchers(
                    "/css/**",
                    "/js/**",
                    "/images/**",
                    "/webjars/**",
                    "/login",
                    "/fragments/**"
                ).permitAll()

                // Everything else requires authentication
                .anyRequest().authenticated()
            )

            // --- Login Config ---
            .formLogin(form -> form
                .loginPage("/login")               // Custom login page (if exists)
                .defaultSuccessUrl("/", true)      // Redirect after successful login
                .permitAll()
            )

            // --- Logout Config ---
            .logout(logout -> logout
                .logoutUrl("/logout")
                .logoutSuccessUrl("/login?logout")
                .permitAll()
            )

            // --- Frame Options (🧩 Fix iframe “DENY” problem) ---
            // Allow iframes from same origin (e.g., your appointment modal’s embedded patient search)
            .headers(headers -> headers
                .frameOptions(frame -> frame.sameOrigin())
            );

        return http.build();
    }
}
