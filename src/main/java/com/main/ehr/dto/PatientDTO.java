package com.main.ehr.dto;

import com.main.ehr.model.Patient;
import java.time.LocalDate;

public record PatientDTO(
        Long id,
        String title,
        String firstName,
        String middleName,
        String lastName,
        String gender,
        LocalDate dob,
        String phonePrimary,
        String phoneSecondary,
        String email,
        String addressLine1,
        String addressLine2,
        String city,
        String state,
        String zip
) {
    public static PatientDTO from(Patient p) {
        if (p == null) return null;

        return new PatientDTO(
                p.getId(),
                safe(p.getTitle()),
                safe(p.getFirstName()),
                safe(p.getMiddleName()),
                safe(p.getLastName()),
                safe(p.getGender()),
                p.getDob(),
                safe(p.getPhonePrimary()),
                safe(p.getPhoneSecondary()),
                safe(p.getEmail()),
                safe(p.getAddressLine1()),
                safe(p.getAddressLine2()),
                safe(p.getCity()),
                safe(p.getState()),
                safe(p.getZip())
        );
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }
}
