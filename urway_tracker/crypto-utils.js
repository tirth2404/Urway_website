/**
 * Encryption Utility for U'rWay Intelligence
 * Implements AES-256 end-to-end encryption with time-based key derivation
 * Key derived from: SHA-256(email + first_login_timestamp)
 */

class CryptoUtils {
    /**
     * Derive encryption key from email and login timestamp
     * Returns a CryptoKey for AES-256-GCM encryption
     */
    static async deriveKeyFromTimestamp(email, loginTimestamp) {
        // Create key material from email + timestamp (both are deterministic)
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(email + "|" + loginTimestamp),
            { name: "PBKDF2" },
            false,
            ["deriveBits", "deriveKey"]
        );

        // Derive a 256-bit key using PBKDF2
        return await crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: new TextEncoder().encode("urway_intelligence_salt_v1"),
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    }

    /**
     * Derive master key from timestamp (for admin access)
     * Master key = derived from system timestamp + fixed salt
     */
    static async deriveMasterKey(masterKeyTimestamp) {
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode("MASTER_KEY|" + masterKeyTimestamp),
            { name: "PBKDF2" },
            false,
            ["deriveBits", "deriveKey"]
        );

        return await crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: new TextEncoder().encode("urway_master_key_salt_v1"),
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    }

    /**
     * Encrypt activity data with AES-256-GCM
     * Returns base64 encoded encrypted data with IV prepended
     */
    static async encryptActivity(activity, encryptionKey) {
        try {
            // Generate random IV (12 bytes for GCM)
            const iv = crypto.getRandomValues(new Uint8Array(12));

            // Convert activity object to JSON string
            const plaintext = JSON.stringify(activity);
            const plaintextBuffer = new TextEncoder().encode(plaintext);

            // Encrypt using AES-256-GCM
            const encryptedData = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                encryptionKey,
                plaintextBuffer
            );

            // Combine IV + encrypted data and convert to base64
            const combined = new Uint8Array(iv.length + encryptedData.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encryptedData), iv.length);

            return btoa(String.fromCharCode.apply(null, combined));
        } catch (error) {
            console.error("❌ Encryption failed:", error);
            throw error;
        }
    }

    /**
     * Decrypt activity data
     */
    static async decryptActivity(encryptedBase64, encryptionKey) {
        try {
            // Decode base64
            const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

            // Extract IV (first 12 bytes)
            const iv = combined.slice(0, 12);
            const encryptedData = combined.slice(12);

            // Decrypt using AES-256-GCM
            const decryptedData = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                encryptionKey,
                encryptedData
            );

            // Convert decrypted bytes to JSON object
            const plaintext = new TextDecoder().decode(decryptedData);
            return JSON.parse(plaintext);
        } catch (error) {
            console.error("❌ Decryption failed:", error);
            throw error;
        }
    }

    /**
     * Encrypt entire footprint array
     */
    static async encryptFootprint(footprint, encryptionKey) {
        const encrypted = [];
        for (const activity of footprint) {
            const encryptedActivity = await this.encryptActivity(activity, encryptionKey);
            encrypted.push(encryptedActivity);
        }
        return encrypted;
    }

    /**
     * Hash email to create userId (deterministic)
     */
    static async hashEmail(email) {
        const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
        const hashArray = Array.from(new Uint8Array(buffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return parseInt(hashHex.substring(0, 8), 16) % 100000000;
    }

    /**
     * Get current timestamp in milliseconds
     */
    static getCurrentTimestamp() {
        return Date.now();
    }
}

// Expose on global scope explicitly for workers/service-workers
try{
    if (typeof self !== 'undefined') self.CryptoUtils = CryptoUtils;
}catch(e){/* ignore */}

