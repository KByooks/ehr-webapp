package com.main.ehr.dto;

public record AppointmentRequest(
    Long providerId,
    Long patientId,
    String appointmentType,
    String reason,
    String status,
    String date,
    String timeStart,
    String timeEnd,
    Integer durationMinutes
) {}
