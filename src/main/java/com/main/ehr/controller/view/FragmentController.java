package com.main.ehr.controller.view;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class FragmentController {

    @GetMapping("/fragments/{section}")
    public String getFragment(@PathVariable String section) {
        // Always return a fragment (:: content) except when a file is a full-page template
        return switch (section.toLowerCase()) {
            case "scheduler" -> "fragments/scheduler :: content";
            case "appointment-details" -> "fragments/appointment-details :: content";
            case "patient" -> "fragments/patient :: content";
            case "billing" -> "fragments/billing :: content";
            case "reports" -> "fragments/reports :: content";
            case "demographics" -> "fragments/demographics :: content";
            default -> "fragments/scheduler :: content";
        };
    }
}
