// ES module version of CryptoUtils for React app (uses Web Crypto API)
export default class CryptoUtils {
    static async deriveKeyFromTimestamp(email, loginTimestamp) {
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(email + "|" + loginTimestamp),
            { name: "PBKDF2" },
            false,
            ["deriveBits", "deriveKey"]
        );

        return await crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: new TextEncoder().encode("urway_intelligence_salt_v1"), iterations: 100000, hash: "SHA-256" },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    }

    static async decryptActivity(encryptedBase64, encryptionKey) {
        const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        const iv = combined.slice(0, 12);
        const encryptedData = combined.slice(12);
        const decryptedData = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, encryptionKey, encryptedData);
        const plaintext = new TextDecoder().decode(decryptedData);
        return JSON.parse(plaintext);
    }
}
