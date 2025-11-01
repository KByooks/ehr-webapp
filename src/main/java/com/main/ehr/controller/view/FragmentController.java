package com.main.ehr.controller.view;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/**
 * Fragment Controller
 * 
 * Dynamically serves Thymeleaf fragments for modular page sections.
 * Keeps navigation and modal systems consistent across the EHR app.
 */
@Controller
public class FragmentController {

    @GetMapping("/fragments/{section}")
    public String getFragment(@PathVariable String section) {
        return switch (section.toLowerCase()) {
            case "scheduler" -> "fragments/scheduler :: content";
            case "appointment-details" -> "fragments/appointment-details";
            case "billing" -> "fragments/billing :: content";
            case "reports" -> "fragments/reports :: content";
            case "patient" -> "fragments/patient :: content"; // ✅ ensure “:: content” is present
            case "demographics" -> "fragments/demographics :: content";
            default -> "fragments/scheduler :: content";
        };
    }
}
