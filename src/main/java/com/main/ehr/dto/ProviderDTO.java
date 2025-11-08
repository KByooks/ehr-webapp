package com.main.ehr.dto;

import com.main.ehr.model.Provider;

public record ProviderDTO(
        Long id,
        String title,
        String firstName,
        String lastName,
        String specialty,
        String phone,
        String email,
        boolean active,
        boolean inPractice,
        String displayName
) {
    public static ProviderDTO from(Provider p) {
        if (p == null) return null;
        String display = (safe(p.getTitle()) + " " +
                safe(p.getFirstName()) + " " +
                safe(p.getLastName())).trim();
        return new ProviderDTO(
                p.getId(),
                safe(p.getTitle()),
                safe(p.getFirstName()),
                safe(p.getLastName()),
                safe(p.getSpecialty()),
                safe(p.getPhone()),
                safe(p.getEmail()),
                p.isActive(),
                p.isInPractice(),
                display
        );
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }
}
