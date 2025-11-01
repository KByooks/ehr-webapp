package com.main.ehr.repository;

import com.main.ehr.model.Appointment;
import com.main.ehr.model.Provider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    List<Appointment> findByProviderAndDate(Provider provider, LocalDate date);

    List<Appointment> findByProviderId(Long providerId);

    List<Appointment> findByDateBetween(LocalDate start, LocalDate end);
    
    List<Appointment> findByProviderIdAndDateBetween(Long providerId, LocalDate start, LocalDate end);
    
    

}
