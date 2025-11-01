// /src/main/java/com/main/ehr/util/FormatUtils.java
package com.main.ehr.util;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

public class FormatUtils {
    private static final DateTimeFormatter DOB_FORMAT = DateTimeFormatter.ofPattern("MM/dd/yyyy");

    public static String formatDob(LocalDate dob) {
        if (dob == null) return "";
        try {
            return dob.format(DOB_FORMAT);
        } catch (Exception e) {
            return dob.toString();
        }
    }
}
