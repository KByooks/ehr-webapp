package com.main.ehr.repository;

import com.main.ehr.model.Patient;

import java.time.LocalDate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.JpaRepository;

@Repository
public interface PatientRepository extends JpaRepository<Patient, Long> {

	@Query("""
			SELECT p FROM Patient p
			WHERE
			  (:firstName IS NULL OR LOWER(p.firstName) LIKE LOWER(CONCAT(:firstName, '%')))
			  AND (:lastName IS NULL OR LOWER(p.lastName) LIKE LOWER(CONCAT(:lastName, '%')))
			  AND (:dob IS NULL OR p.dob = :dob)
			  AND (:phone IS NULL OR LOWER(p.phonePrimary) LIKE LOWER(CONCAT('%', :phone, '%')))
			  AND (:email IS NULL OR LOWER(p.email) LIKE LOWER(CONCAT('%', :email, '%')))
			  AND (:city IS NULL OR LOWER(p.city) LIKE LOWER(CONCAT('%', :city, '%')))
			  AND (:state IS NULL OR LOWER(p.state) LIKE LOWER(CONCAT('%', :state, '%')))
			  AND (:zip IS NULL OR LOWER(p.zip) LIKE LOWER(CONCAT('%', :zip, '%')))
			""")
			Page<Patient> searchPatients(
			    @Param("firstName") String firstName,
			    @Param("lastName") String lastName,
			    @Param("dob") LocalDate dob,
			    @Param("phone") String phone,
			    @Param("email") String email,
			    @Param("city") String city,
			    @Param("state") String state,
			    @Param("zip") String zip,
			    Pageable pageable
			);




}
