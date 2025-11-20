package com.main.ehr.dto;

import java.time.LocalDate;
import java.time.LocalTime;

public record AppointmentDTO(
        Long id,
        LocalDate date,
        LocalTime timeStart,
        LocalTime timeEnd,
        Integer duration,
        String appointmentType,
        String status,
        String reason,
        Long providerId,   // ★ add
        Long patientId,    // ★ add
        ProviderDTO provider,
        PatientDTO patient
) {}

