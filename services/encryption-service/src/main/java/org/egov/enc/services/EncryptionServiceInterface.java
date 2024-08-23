package org.egov.enc.services;

import org.egov.enc.models.Ciphertext;
import org.egov.enc.models.Plaintext;

import jakarta.crypto.BadPaddingException;
import jakarta.crypto.IllegalBlockSizeException;
import jakarta.crypto.NoSuchPaddingException;
import java.security.InvalidAlgorithmParameterException;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.security.spec.InvalidKeySpecException;

public interface EncryptionServiceInterface {

    public Ciphertext encrypt(Plaintext plaintext) throws NoSuchPaddingException, InvalidKeyException, NoSuchAlgorithmException, IllegalBlockSizeException, BadPaddingException, InvalidAlgorithmParameterException, InvalidKeySpecException;

    public Plaintext decrypt(Ciphertext ciphertext) throws NoSuchPaddingException, InvalidKeyException, NoSuchAlgorithmException, IllegalBlockSizeException, BadPaddingException, InvalidAlgorithmParameterException, InvalidKeySpecException;

}
