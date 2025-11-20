package com.main.ehr.mapper;

import java.time.LocalDate;
import java.time.LocalTime;

import com.main.ehr.dto.*;
import com.main.ehr.model.*;

public class AppointmentMapper {

    public static AppointmentDTO toDto(Appointment a) {
        if (a == null) return null;

        return new AppointmentDTO(
        	    a.getId(),
        	    a.getDate(),
        	    a.getTimeStart(),
        	    a.getTimeEnd(),
        	    a.getDurationMinutes(),
        	    a.getAppointmentType(),
        	    a.getStatus(),
        	    a.getReason(),
        	    a.getProvider() != null ? a.getProvider().getId() : null, // providerId
        	    a.getPatient() != null ? a.getPatient().getId() : null,   // patientId
        	    ProviderDTO.from(a.getProvider()),
        	    PatientDTO.from(a.getPatient())
        	);

    }

    public static void applyRequest(Appointment a, AppointmentRequest req,
                                    Provider provider, Patient patient) {

        a.setProvider(provider);
        a.setPatient(patient);

        a.setDate(LocalDate.parse(req.date()));
        a.setTimeStart(LocalTime.parse(req.timeStart()));
        a.setTimeEnd(LocalTime.parse(req.timeEnd()));

        a.setDurationMinutes(req.duration() != null ? req.duration() : 15);

        a.setAppointmentType(req.appointmentType());
        a.setStatus(req.status());
        a.setReason(req.reason());
    }
}
