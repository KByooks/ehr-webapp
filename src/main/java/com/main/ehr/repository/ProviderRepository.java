package com.main.ehr.repository;

import com.main.ehr.model.Provider;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ProviderRepository extends JpaRepository<Provider, Long> {

    @Query("""
        SELECT p FROM Provider p
        WHERE
          (
            :inPracticeOnly IS NULL
            OR (:inPracticeOnly = TRUE AND p.inPractice = TRUE)
            OR (:inPracticeOnly = FALSE AND p.inPractice = FALSE)
          )
          AND (
            :activeOnly IS NULL
            OR (:activeOnly = TRUE AND p.active = TRUE)
            OR (:activeOnly = FALSE AND p.active = FALSE)
          )
          AND (
            :firstName IS NULL
            OR (
                (LENGTH(:firstName) <= 1 AND LOWER(p.firstName) LIKE LOWER(CONCAT(:firstName, '%')))
                OR (LENGTH(:firstName) > 1 AND LOWER(p.firstName) LIKE LOWER(CONCAT('%', :firstName, '%')))
            )
          )
          AND (
            :lastName IS NULL
            OR LOWER(p.lastName) LIKE LOWER(CONCAT('%', :lastName, '%'))
          )
          AND (
            :specialty IS NULL
            OR LOWER(p.specialty) LIKE LOWER(CONCAT('%', :specialty, '%'))
          )
        """)
    Page<Provider> searchProviders(
        @Param("firstName") String firstName,
        @Param("lastName") String lastName,
        @Param("specialty") String specialty,
        @Param("inPracticeOnly") Boolean inPracticeOnly,
        @Param("activeOnly") Boolean activeOnly,
        Pageable pageable
    );
}
