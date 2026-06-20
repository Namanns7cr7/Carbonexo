package com.ecotrack.auth;

import com.ecotrack.config.AppProperties;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.stereotype.Component;

import java.util.Collections;

/**
 * Verifies Google Sign-In ID tokens against Google's public keys, checking the
 * signature, expiry, issuer and audience (our OAuth Web client ID). Returns the
 * decoded payload (email, name, sub, ...) or {@code null} if the token is invalid.
 */
@Component
public class GoogleTokenVerifier {

    private final String clientId;
    private volatile GoogleIdTokenVerifier verifier;

    public GoogleTokenVerifier(AppProperties props) {
        this.clientId = props.security().google() != null
                ? props.security().google().clientId()
                : null;
    }

    /** @return true when a Google OAuth client id is configured (server can do Google login). */
    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank();
    }

    /**
     * @return the verified token payload, or {@code null} if the token is invalid,
     * malformed, expired, or fails audience/signature checks. Treating all of these
     * as {@code null} keeps a bad token a 401 rather than a 500.
     */
    public GoogleIdToken.Payload verify(String idTokenString) {
        if (!isConfigured()) {
            throw new IllegalStateException("Google login is not configured (missing GOOGLE_CLIENT_ID)");
        }
        try {
            GoogleIdToken token = verifier().verify(idTokenString);
            return token != null ? token.getPayload() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private GoogleIdTokenVerifier verifier() {
        GoogleIdTokenVerifier v = verifier;
        if (v == null) {
            synchronized (this) {
                v = verifier;
                if (v == null) {
                    v = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), GsonFactory.getDefaultInstance())
                            .setAudience(Collections.singletonList(clientId))
                            .build();
                    verifier = v;
                }
            }
        }
        return v;
    }
}
