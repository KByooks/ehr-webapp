package com.main.ehr.controller.api;

import com.main.ehr.model.Patient;
import com.main.ehr.repository.PatientRepository;
import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.main.ehr.util.FormatUtils;

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

	@GetMapping("/search")
	public Map<String, Object> searchPatients(@RequestParam(required = false) String firstName,
			@RequestParam(required = false) String lastName, @RequestParam(required = false) String dob,
			@RequestParam(required = false) String phone, @RequestParam(required = false) String email,
			@RequestParam(required = false) String city, @RequestParam(required = false) String state,
			@RequestParam(required = false) String zip, @RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "lastName") String sortBy,
			@RequestParam(defaultValue = "asc") String sortDir) {

		// --- Split "name" field into first and last ---

		LocalDate parsedDob = null;
		if (dob != null && !dob.isBlank()) {
			String cleaned = dob.replaceAll("[^0-9]", ""); // remove non-digits
			try {
				if (cleaned.length() == 8) {
					// Try MMDDYYYY
					DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMddyyyy");
					parsedDob = LocalDate.parse(cleaned, fmt);
				} else if (dob.contains("-")) {
					// Try ISO (YYYY-MM-DD)
					parsedDob = LocalDate.parse(dob);
				}
			} catch (DateTimeParseException e) {
				System.out.println("⚠️ Could not parse DOB: " + dob);
			}
		}

		// --- Normalize blank params to null ---
		firstName = normalize(firstName);
		lastName = normalize(lastName);
		phone = normalize(phone);
		email = normalize(email);
		city = normalize(city);
		state = normalize(state);
		zip = normalize(zip);

		// --- Sorting and paging ---
		Sort sort = sortDir.equalsIgnoreCase("desc") ? Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();

		Pageable pageable = PageRequest.of(page, size, sort);

		// --- Query repository ---
		Page<Patient> resultPage = patientRepository.searchPatients(firstName, lastName, parsedDob, phone, email, city,
				state, zip, pageable);

		// --- Transform results to lightweight maps ---
		List<Map<String, Object>> patients = resultPage.getContent().stream().map(p -> {
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
		}).collect(Collectors.toList());

		// --- Return JSON ---
		return Map.of("patients", patients, "page", resultPage.getNumber(), "totalPages", resultPage.getTotalPages(),
				"totalElements", resultPage.getTotalElements());
	}

	@PostMapping("/add")
	public ResponseEntity<?> addPatient(@RequestBody Patient newPatient) {
		if (newPatient.getFirstName() == null || newPatient.getLastName() == null || newPatient.getDob() == null) {
			return ResponseEntity.badRequest().body(Map.of("error", "Missing required fields"));
		}

		return ResponseEntity.ok(patientRepository.save(newPatient));
	}

	// --- Utility helpers ---
	private static String normalize(String s) {
		return (s == null || s.isBlank()) ? null : s.trim();
	}

	private static String safe(String s) {
		return s == null ? "" : s;
	}
}
