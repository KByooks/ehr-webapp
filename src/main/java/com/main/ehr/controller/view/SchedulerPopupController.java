package com.main.ehr.controller.view;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class SchedulerPopupController {

    @GetMapping("/scheduler-popup")
    public String openSchedulerPopup(
            @RequestParam(name = "providerId", required = false, defaultValue = "1") int providerId) {
        return "scheduler-popup";
    }
}
