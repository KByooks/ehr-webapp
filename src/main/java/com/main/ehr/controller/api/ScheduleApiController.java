package com.main.ehr.controller.api;

import com.main.ehr.dto.AppointmentRequest;
import com.main.ehr.model.Appointment;
import com.main.ehr.model.Patient;
import com.main.ehr.model.Provider;
import com.main.ehr.repository.AppointmentRepository;
import com.main.ehr.repository.PatientRepository;
import com.main.ehr.repository.ProviderRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.*;
import java.util.*;

@RestController
@RequestMapping("/api/schedule")
public class ScheduleApiController {

    private final AppointmentRepository appointmentRepository;
    private final ProviderRepository providerRepository;
    private final PatientRepository patientRepository;

    public ScheduleApiController(AppointmentRepository appointmentRepository,
                                 ProviderRepository providerRepository,
                                 PatientRepository patientRepository) {
        this.appointmentRepository = appointmentRepository;
        this.providerRepository = providerRepository;
        this.patientRepository = patientRepository;
    }

    // ---------- Provider schedule for FullCalendar ----------
    @GetMapping("/{providerId}")
    public List<Map<String, Object>> getSchedule(
            @PathVariable Long providerId,
            @RequestParam(required = false) String start,
            @RequestParam(required = false) String end) {

        LocalDate startDate = start != null ? LocalDate.parse(start.substring(0, 10)) : LocalDate.now();
        LocalDate endDate = end != null ? LocalDate.parse(end.substring(0, 10)) : LocalDate.now().plusDays(7);

        List<Appointment> appts = appointmentRepository.findByProviderId(providerId);
        List<Map<String, Object>> events = new ArrayList<>();

        for (Appointment a : appts) {
            if (a.getDate().isBefore(startDate) || a.getDate().isAfter(endDate)) continue;

            Map<String, Object> e = new HashMap<>();
            e.put("id", a.getId());
            e.put("title", a.getPatient() != null
                    ? a.getPatient().getFirstName() + " " + a.getPatient().getLastName()
                    : "(Unassigned)");
            e.put("start", LocalDateTime.of(a.getDate(), a.getTimeStart()).toString());
            e.put("end", LocalDateTime.of(a.getDate(), a.getTimeEnd()).toString());
            e.put("status", a.getStatus());
            e.put("appointmentType", a.getAppointmentType());
            e.put("reason", a.getReason());
            e.put("providerId", providerId);
            events.add(e);
        }
        return events;
    }

    // ---------- Read single appointment for edit ----------
    @GetMapping("/appointment/{id}")
    public ResponseEntity<?> getAppointmentById(@PathVariable Long id) {
        return appointmentRepository.findById(id)
                .map(a -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", a.getId());
                    m.put("date", a.getDate().toString());
                    m.put("timeStart", a.getTimeStart().toString());
                    m.put("timeEnd", a.getTimeEnd().toString());
                    m.put("appointmentType", a.getAppointmentType());
                    m.put("status", a.getStatus());
                    m.put("reason", a.getReason());
                    m.put("providerId", a.getProvider() != null ? a.getProvider().getId() : null);
                    if (a.getPatient() != null) {
                        Map<String, Object> p = new HashMap<>();
                        p.put("id", a.getPatient().getId());
                        p.put("firstName", a.getPatient().getFirstName());
                        p.put("lastName", a.getPatient().getLastName());
                        m.put("patient", p);
                    }
                    return ResponseEntity.ok(m);
                })
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Appointment not found")));
    }

    // ---------- Create ----------
    @PostMapping("/create")
    public ResponseEntity<?> createAppointment(@RequestBody AppointmentRequest req) {
        try {
            if (req.patientId() == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "error", "Missing patient ID"));
            }

            Provider provider = providerRepository.findById(req.providerId())
                    .orElseThrow(() -> new RuntimeException("Provider not found"));

            Patient patient = patientRepository.findById(req.patientId())
                    .orElseThrow(() -> new RuntimeException("Patient not found"));

            Appointment appt = new Appointment();
            appt.setProvider(provider);
            appt.setPatient(patient);
            appt.setAppointmentType(req.appointmentType());
            appt.setReason(req.reason());
            appt.setStatus(req.status() != null ? req.status() : "Scheduled");
            appt.setDate(LocalDate.parse(req.date()));
            appt.setTimeStart(LocalTime.parse(req.timeStart()));
            appt.setTimeEnd(LocalTime.parse(req.timeEnd()));
            appt.setDurationMinutes(req.durationMinutes() != null ? req.durationMinutes() : 15);

            appointmentRepository.save(appt);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "id", appt.getId()
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // ---------- Update (PUT /api/schedule/{id}) ----------
    @PutMapping("/{id}")
    public ResponseEntity<?> updateAppointment(@PathVariable Long id, @RequestBody AppointmentRequest req) {
        try {
            Appointment appt = appointmentRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Appointment not found"));

            if (req.providerId() != null) {
                Provider provider = providerRepository.findById(req.providerId())
                        .orElseThrow(() -> new RuntimeException("Provider not found"));
                appt.setProvider(provider);
            }
            if (req.patientId() != null) {
                Patient patient = patientRepository.findById(req.patientId())
                        .orElseThrow(() -> new RuntimeException("Patient not found"));
                appt.setPatient(patient);
            }
            if (req.appointmentType() != null) appt.setAppointmentType(req.appointmentType());
            if (req.reason() != null) appt.setReason(req.reason());
            if (req.status() != null) appt.setStatus(req.status());
            if (req.date() != null) appt.setDate(LocalDate.parse(req.date()));
            if (req.timeStart() != null) appt.setTimeStart(LocalTime.parse(req.timeStart()));
            if (req.timeEnd() != null) appt.setTimeEnd(LocalTime.parse(req.timeEnd()));
            if (req.durationMinutes() != null) appt.setDurationMinutes(req.durationMinutes());

            appointmentRepository.save(appt);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "id", appt.getId()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // ---------- Delete (DELETE /api/schedule/{id}) ----------
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAppointment(@PathVariable Long id) {
        try {
            if (!appointmentRepository.existsById(id)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("success", false, "error", "Appointment not found"));
            }
            appointmentRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }
}
