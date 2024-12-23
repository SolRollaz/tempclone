import crypto from 'crypto';


class VaultHandler {
    constructor() {
        this.algorithm = 'aes-256-ctr';  // AES256 encryption for strong security
        this.secretKey = process.env.ENCRYPTION_KEY;  // The master encryption key (stored securely in .env file)
    }

    /**
     * Encrypt the given private key using AES-256-CTR algorithm.
     * @param {string} privateKey - The private key to be encrypted.
     * @returns {string} - The encrypted private key, along with the IV used for encryption.
     */
    encrypt(privateKey) {
        const iv = crypto.randomBytes(16);  // Generate a random 16-byte IV for encryption
        const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.secretKey), iv);
        let encrypted = cipher.update(privateKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Return the IV and encrypted private key (separated by a colon)
        return iv.toString('hex') + ':' + encrypted;
    }

    /**
     * Decrypt the given encrypted private key.
     * @param {string} encryptedPrivateKey - The encrypted private key (IV + encrypted key).
     * @returns {string} - The decrypted private key.
     */
    decrypt(encryptedPrivateKey) {
        const textParts = encryptedPrivateKey.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');  // Extract the IV from the first part
        const encryptedText = textParts.join(':');  // Join the remaining parts (in case there's a colon in the encrypted text)

        const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(this.secretKey), iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;  // Return the decrypted private key
    }
}

module.exports = VaultHandler;
