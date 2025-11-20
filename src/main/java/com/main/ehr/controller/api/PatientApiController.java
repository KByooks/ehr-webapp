package com.main.ehr.controller.api;

import com.main.ehr.mapper.PatientMapper;
import com.main.ehr.model.Patient;
import com.main.ehr.repository.PatientRepository;
import com.main.ehr.util.FormatUtils;
import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/patients")
public class PatientApiController {

    private final PatientRepository patientRepository;

    public PatientApiController(PatientRepository patientRepository) {
        this.patientRepository = patientRepository;
    }

    // ============================
    // Search
    // ============================
    @GetMapping("/search")
    public Map<String, Object> searchPatients(
            @RequestParam(required = false) String firstName,
            @RequestParam(required = false) String lastName,
            @RequestParam(required = false) String dob,
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String zip,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "lastName") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir
    ) {

        LocalDate parsedDob = null;
        if (dob != null && !dob.isBlank()) {
            String cleaned = dob.replaceAll("[^0-9]", "");
            try {
                if (cleaned.length() == 8) {
                    DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMddyyyy");
                    parsedDob = LocalDate.parse(cleaned, fmt);
                } else if (dob.contains("-")) {
                    parsedDob = LocalDate.parse(dob);
                }
            } catch (DateTimeParseException ignored) { }
        }

        firstName = normalize(firstName);
        lastName  = normalize(lastName);
        phone     = normalize(phone);
        email     = normalize(email);
        city      = normalize(city);
        state     = normalize(state);
        zip       = normalize(zip);

        Sort sort = sortDir.equalsIgnoreCase("desc")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();

        Pageable pageable = PageRequest.of(page, size, sort);

        Page<Patient> resultPage = patientRepository.searchPatients(
                firstName, lastName, parsedDob, phone, email, city, state, zip, pageable
        );

        List<Map<String, Object>> patients = resultPage.getContent().stream()
                .map(p -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", p.getId());
                    m.put("firstName", safe(p.getFirstName()));
                    m.put("lastName", safe(p.getLastName()));
                    m.put("dob", FormatUtils.formatDob(p.getDob()));
                    m.put("phone", safe(p.getPhonePrimary()));
                    m.put("address", safe(p.getAddressLine1()));
                    m.put("city", safe(p.getCity()));
                    m.put("state", safe(p.getState()));
                    m.put("zip", safe(p.getZip()));
                    m.put("email", safe(p.getEmail()));
                    return m;
                })
                .collect(Collectors.toList());


        return Map.of(
                "patients", patients,
                "page", resultPage.getNumber(),
                "totalPages", resultPage.getTotalPages(),
                "totalElements", resultPage.getTotalElements()
        );
    }

    // ============================
    // Get single patient
    // ============================
    @GetMapping("/{id}")
    public ResponseEntity<?> getPatient(@PathVariable Long id) {
        return patientRepository.findById(id)
                .map(p -> ResponseEntity.ok(PatientMapper.from(p)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }


    // ============================
    // Create patient
    // ============================
    @PostMapping
    public ResponseEntity<?> createPatient(@RequestBody Patient p) {

        if (p.getFirstName() == null || p.getLastName() == null || p.getDob() == null) {
            return ResponseEntity.badRequest().body("Missing required fields");
        }

        Patient saved = patientRepository.save(p);
        return ResponseEntity.ok(saved);   // ← RETURN CLEAN OBJECT
    }

    // ============================
    // Update patient
    // ============================
    @PutMapping("/{id}")
    public ResponseEntity<?> updatePatient(
            @PathVariable Long id,
            @RequestBody Patient payload
    ) {
        return patientRepository.findById(id)
                .map(existing -> {
                    existing.setTitle(payload.getTitle());
                    existing.setGender(payload.getGender());
                    existing.setFirstName(payload.getFirstName());
                    existing.setMiddleName(payload.getMiddleName());
                    existing.setLastName(payload.getLastName());
                    existing.setDob(payload.getDob());
                    existing.setPhonePrimary(payload.getPhonePrimary());
                    existing.setPhoneSecondary(payload.getPhoneSecondary());
                    existing.setEmail(payload.getEmail());
                    existing.setAddressLine1(payload.getAddressLine1());
                    existing.setAddressLine2(payload.getAddressLine2());
                    existing.setCity(payload.getCity());
                    existing.setState(payload.getState());
                    existing.setZip(payload.getZip());

                    Patient saved = patientRepository.save(existing);
                    return ResponseEntity.ok(saved);  // ← CLEAN OBJECT
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // helpers
    private static String normalize(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }
}
