package com.main.ehr.controller.view;

import com.main.ehr.model.Patient;
import com.main.ehr.repository.PatientRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@Controller
public class DemographicsController {

    private final PatientRepository patientRepository;

    public DemographicsController(PatientRepository patientRepository) {
        this.patientRepository = patientRepository;
    }

    @GetMapping("/demographics")
    public String demographicsPage() {
        return "demographics"; // loads templates/demographics.html
    }

    @ResponseBody
    @GetMapping("/api/patients/{id}")
    public Patient getPatientById(@PathVariable Long id) {
        return patientRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Patient not found"));
    }
}
