package com.main.ehr.controller.api;

import com.main.ehr.dto.AppointmentRequest;
import com.main.ehr.mapper.AppointmentMapper;
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
    @GetMapping("/provider/{providerId}")
    public List<Map<String, Object>> getSchedule(
            @PathVariable Long providerId,
            @RequestParam(required = false) String start,
            @RequestParam(required = false) String end) {

        LocalDate startDate = start != null ? LocalDate.parse(start.substring(0, 10)) : LocalDate.now();
        LocalDate endDate   = end != null ? LocalDate.parse(end.substring(0, 10)) : LocalDate.now().plusDays(7);

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
            e.put("providerId", a.getProvider().getId());
            events.add(e);
        }
        return events;
    }

    // ---------- Read single appointment (DTO) ----------
    @GetMapping("/appointment/{id}")
    public ResponseEntity<?> getAppointmentById(@PathVariable Long id) {
        Optional<Appointment> opt = appointmentRepository.findById(id);

        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Appointment not found"));
        }

        return ResponseEntity.ok(AppointmentMapper.toDto(opt.get()));
    }

    // ---------- Create ----------
    @PostMapping("")
    public ResponseEntity<?> createAppointment(@RequestBody Map<String, Object> body) {
        try {
            Long providerId = body.get("providerId") == null ? null :
                    ((Number) body.get("providerId")).longValue();

            Long patientId = body.get("patientId") == null ? null :
                    ((Number) body.get("patientId")).longValue();

            if (providerId == null || patientId == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "error", "Missing patient or provider ID"));
            }

            Provider provider = providerRepository.findById(providerId)
                    .orElseThrow(() -> new RuntimeException("Provider not found"));

            Patient patient = patientRepository.findById(patientId)
                    .orElseThrow(() -> new RuntimeException("Patient not found"));

            Appointment a = new Appointment();
            a.setProvider(provider);
            a.setPatient(patient);
            a.setDate(LocalDate.parse((String) body.get("date")));
            a.setTimeStart(LocalTime.parse((String) body.get("timeStart")));
            a.setTimeEnd(LocalTime.parse((String) body.get("timeEnd")));

            Integer duration = (Integer) body.getOrDefault("duration", 15);
            a.setDurationMinutes(duration);

            a.setAppointmentType((String) body.get("appointmentType"));
            a.setStatus((String) body.get("status"));
            a.setReason((String) body.get("reason"));

            appointmentRepository.save(a);

            return ResponseEntity.ok(Map.of("success", true, "id", a.getId()));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // ---------- Update ----------
    @PutMapping("/{id}")
    public ResponseEntity<?> updateAppointment(
            @PathVariable Long id,
            @RequestBody AppointmentRequest req) {

        try {
            Appointment a = appointmentRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Appointment not found"));

            // ---- Provider ----
            if (req.providerId() != null) {
                Provider provider = providerRepository.findById(req.providerId())
                        .orElseThrow(() -> new RuntimeException("Provider not found"));
                a.setProvider(provider);
            }
            // If null → keep existing provider automatically


            // ---- Patient ----
            if (req.patientId() != null) {
                Patient patient = patientRepository.findById(req.patientId())
                        .orElseThrow(() -> new RuntimeException("Patient not found"));
                a.setPatient(patient);
            }

            // ---- Basic fields ----
            if (req.date() != null) a.setDate(LocalDate.parse(req.date()));
            if (req.timeStart() != null) a.setTimeStart(LocalTime.parse(req.timeStart()));
            if (req.timeEnd() != null) a.setTimeEnd(LocalTime.parse(req.timeEnd()));

            if (req.duration() != null) a.setDurationMinutes(req.duration());
            if (req.appointmentType() != null) a.setAppointmentType(req.appointmentType());
            if (req.status() != null) a.setStatus(req.status());
            if (req.reason() != null) a.setReason(req.reason());

            appointmentRepository.save(a);

            return ResponseEntity.ok(Map.of("success", true, "id", a.getId()));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }


    // ---------- Delete ----------
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
