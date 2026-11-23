package com.ged.common;

import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/**
 * Toutes les erreurs sortent au même format :
 * { status, title, detail, code, errors: { champ: message } }.
 * Le front-end les lit dans services/api/errors.ts.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ProblemDetail handleApi(ApiException e) {
        return problem(e.status(), e.code(), e.getMessage(), e.fieldErrors());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> errors = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().forEach(f -> errors.putIfAbsent(f.getField(), f.getDefaultMessage()));
        return problem(HttpStatus.BAD_REQUEST, "VALIDATION", "Certaines informations sont invalides", errors);
    }

    @ExceptionHandler(AccessDeniedException.class)
    ProblemDetail handleDenied(AccessDeniedException e) {
        return problem(HttpStatus.FORBIDDEN, "FORBIDDEN", "Vous n'avez pas les droits nécessaires pour cette action", Map.of());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ProblemDetail handleTooLarge(MaxUploadSizeExceededException e) {
        return problem(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "Le fichier dépasse la taille autorisée", Map.of());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail handleIntegrity(DataIntegrityViolationException e) {
        log.warn("Contrainte d'intégrité violée", e);
        return problem(HttpStatus.CONFLICT, "CONFLICT", "Cette valeur est déjà utilisée ou est référencée ailleurs", Map.of());
    }

    private static ProblemDetail problem(HttpStatus status, String code, String detail, Map<String, String> errors) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
        pd.setTitle(detail);
        pd.setProperty("code", code);
        if (!errors.isEmpty()) {
            pd.setProperty("errors", errors);
        }
        return pd;
    }
}
