package com.main.ehr;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@SpringBootApplication
public class EhrApplication {
    public static void main(String[] args) {
    	BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String raw = "admin123";
        String stored = "$2a$10$hGsZRfe/gIEt00rR2OTvTeehQ8FwXejW8zh9uHYgTIsIgFooy3sva"; // paste from DB
        System.out.println("Result:" + encoder.matches(raw, stored));
        
        SpringApplication.run(EhrApplication.class, args);
    }
}
