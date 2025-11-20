package com.main.ehr.mapper;

import com.main.ehr.model.Patient;
import com.main.ehr.dto.PatientDTO;

public class PatientMapper {

    public static PatientDTO from(Patient p) {
        if (p == null) return null;

        return new PatientDTO(
                p.getId(),
                p.getTitle(),
                p.getFirstName(),
                p.getMiddleName(),
                p.getLastName(),
                p.getGender(),
                p.getDob(),
                p.getPhonePrimary(),
                p.getPhoneSecondary(),
                p.getEmail(),
                p.getAddressLine1(),
                p.getAddressLine2(),
                p.getCity(),
                p.getState(),
                p.getZip()
        );
    }
}
