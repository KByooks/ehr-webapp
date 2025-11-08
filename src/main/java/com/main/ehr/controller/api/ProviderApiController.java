package com.main.ehr.controller.api;

import com.main.ehr.dto.ProviderDTO;
import com.main.ehr.model.Provider;
import com.main.ehr.repository.ProviderRepository;
import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/providers")
public class ProviderApiController {

    private final ProviderRepository providerRepository;

    public ProviderApiController(ProviderRepository providerRepository) {
        this.providerRepository = providerRepository;
    }

    // ============================================================
    // 🔍 SEARCH — flexible, paginated provider search
    // ============================================================
    @GetMapping("/search")
    public Map<String, Object> searchProviders(
            @RequestParam(required = false) String firstName,
            @RequestParam(required = false) String lastName,
            @RequestParam(required = false) String specialty,
            @RequestParam(required = false) Boolean inPracticeOnly,
            @RequestParam(required = false) Boolean activeOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "lastName") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir
    ) {
        firstName = normalize(firstName);
        lastName  = normalize(lastName);
        specialty = normalize(specialty);

        Sort sort = sortDir.equalsIgnoreCase("desc")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();

        Pageable pageable = PageRequest.of(page, size, sort);

        Page<Provider> result = providerRepository.searchProviders(
                firstName, lastName, specialty, inPracticeOnly, activeOnly, pageable
        );

        List<ProviderDTO> providers = result.getContent()
                .stream()
                .map(ProviderDTO::from)
                .collect(Collectors.toList());

        return Map.of(
                "providers", providers,
                "page", result.getNumber(),
                "totalPages", result.getTotalPages(),
                "totalElements", result.getTotalElements()
        );
    }

    // ============================================================
    // 👤 SINGLE PROVIDER — by ID (used by scheduler + modals)
    // ============================================================
    @GetMapping("/{id}")
    public ResponseEntity<?> getProvider(@PathVariable Long id) {
        return providerRepository.findById(id)
                .map(p -> ResponseEntity.ok(ProviderDTO.from(p)))
                .orElse(ResponseEntity.notFound().build());
    }

    // ============================================================
    // 🧹 Helpers
    // ============================================================
    private static String normalize(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
