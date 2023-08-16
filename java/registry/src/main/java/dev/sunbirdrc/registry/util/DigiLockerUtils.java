package dev.sunbirdrc.registry.util;

import com.fasterxml.jackson.databind.JsonNode;
import dev.sunbirdrc.registry.digilocker.pulldoc.*;
import dev.sunbirdrc.registry.digilocker.pulluriresponse.*;
import dev.sunbirdrc.registry.digilocker.pulluriresponse.DocDetails;
import dev.sunbirdrc.registry.middleware.util.DateUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NamedNodeMap;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.xml.bind.*;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;

public class DigiLockerUtils {

    public static final String HMAC_SHA_256 = "HmacSHA256";
    private static Logger logger = LoggerFactory.getLogger(DigiLockerUtils.class);

    public static Person getPersonDetail(JsonNode result, String entityName) {
        Person person = new Person();
        JsonNode jsonNode = result.get(entityName);
        if (jsonNode != null && jsonNode.size() > 0) {
            JsonNode regCertificate = jsonNode.get(0);
            JsonNode name = regCertificate.get("name");
            if (name != null)
                person.setName(name.asText());
            JsonNode gender = regCertificate.get("gender");
            if (gender != null)
                person.setGender(gender.asText());
            JsonNode dateOfBirth = regCertificate.get("dob");
            if (dateOfBirth != null)
                person.setDob(dateOfBirth.asText());
            JsonNode mobile = regCertificate.get("contact");
            if (mobile != null)
                person.setPhone(mobile.asText());
        }
        return person;
    }

    public static String getDocUri() {
        String issuerId = "org.upsmfac";
        String doctype = "REGCR";
        int n = 10;
        double docId = Math.floor(Math.random() * (9 * Math.pow(10, n - 1))) + Math.pow(10, (n - 1));
        String docUri = issuerId + "-" + doctype + "-" + docId;
        return docUri;
    }

    public static PullDocRequest processPullDocRequest(String xml) throws Exception{
        PullDocRequest request = new PullDocRequest();
        DocDetailsType docDetails = new DocDetailsType();

        // Create a DocumentBuilderFactory and DocumentBuilder to parse the XML
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        DocumentBuilder builder = factory.newDocumentBuilder();

        // Parse the XML string into a Document object
        Document document = builder.parse(new ByteArrayInputStream(xml.getBytes()));
        Element rootElement = document.getDocumentElement();
        Element docDetailsElement = (Element) rootElement.getElementsByTagName("DocDetails").item(0);
        // Get the values of URI and DigiLockerId elements
        String uri = docDetailsElement.getElementsByTagName("URI").item(0).getTextContent();
        String digiLockerId = docDetailsElement.getElementsByTagName("DigiLockerId").item(0).getTextContent();
        docDetails.setUri(uri);
        docDetails.setDigiLockerId(digiLockerId);
        request.setDocDetails(docDetails);
        // Print the values
        logger.info("URI: " + uri);
        logger.info("DigiLockerId: " + digiLockerId);
        NamedNodeMap attributes = rootElement.getAttributes();
        for (int i = 0; i < attributes.getLength(); i++) {
            String attributeName = attributes.item(i).getNodeName();
            String attributeValue = attributes.item(i).getNodeValue();
            switch (attributeName.toLowerCase()) {
                case "txn":
                    request.setTxn(attributeValue);
                    break;
                case "orgid":
                    request.setOrgId(attributeValue);
                    break;
                case "ts":
                    request.setTs(attributeValue);
                    break;
                case "format":
                    request.setFormat(attributeValue);
                    break;
                case "keyhash":
                    request.setFormat(attributeValue);
                    break;
                case "x-digilocker-hmac":
                    request.setFormat(attributeValue);
                    break;
                default:
                    break;
            }
        }

        return request;
    }

    public static byte[] decryptWithHashKey(byte[] inputData, String hashKey) throws Exception {
        String algorithm = "AES";
        SecretKeySpec secretKey = new SecretKeySpec(hashKey.getBytes(), algorithm);

        Cipher cipher = Cipher.getInstance(algorithm);
        cipher.init(Cipher.DECRYPT_MODE, secretKey);

        return cipher.doFinal(inputData);
    }


    private static byte[] convertObtToByte(Object certificate) {
        byte[] bytes = null;
        try (ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            try (ObjectOutputStream objOutStream = new ObjectOutputStream(bos)) {
                objOutStream.writeObject(certificate);
                objOutStream.flush();
                bytes = bos.toByteArray();
            }
        } catch (Exception e) {
            logger.error("Converting certificate file to stream failed.", e);
        }

        return bytes;
    }

    public static String getXmlString(String xmlString) {
        dev.sunbirdrc.registry.util.DocDetails docDetails;
        try {
            JAXBContext jaxbContext = JAXBContext.newInstance(PullURIRequest.class);
            Unmarshaller jaxbUnmarshaller = jaxbContext.createUnmarshaller();
            PullURIRequest pullUriRequest = (PullURIRequest) jaxbUnmarshaller.unmarshal(new StringReader(xmlString));
            // Access DocDetails using getDocDetails()
            docDetails = pullUriRequest.getDocDetails();
            StringBuffer sb = new StringBuffer();
            sb.append("{");
            if(docDetails.getName()!=null)
                sb.append("\"name\""+":"+"\""+docDetails.getName()+"\""+",");
            if(docDetails.getMobile()!=null)
                sb.append("\"mobile\""+":"+"\""+docDetails.getMobile()+"\""+",");
//            if(docDetails.getDateOfBirth()!=null)
//                sb.append("\"dob\""+":"+"\""+docDetails.getDateOfBirth()+"\""+",");
            if(docDetails.getFinalYearRollNo()!=null)
                sb.append("\"finalYearRollNo\""+":"+"\""+docDetails.getFinalYearRollNo()+"\"");
            sb.append("}");
            xmlString = sb.toString();
        } catch (JAXBException e) {
            e.printStackTrace();
        }
        return xmlString;
    }
    public static PullURIResponse getPullUriResponse(String certUri, String status, String txn, Object certificate, Person person) {
        List<Person> personList = new ArrayList();
        personList.add(person);
        Persons persons = new Persons();
        persons.setPerson(personList);
        PullURIResponse resp = new PullURIResponse();
        ResponseUriStatus responseStatus = new ResponseUriStatus();
        responseStatus.setStatus(status);
        responseStatus.setTxn(txn);
        byte[] bytes = convertObtToByte(certificate);
        responseStatus.setTs(DateUtil.getTimeStamp());
        DocDetails details = new DocDetails();
        IssuedTo issuedTo = new IssuedTo();
        issuedTo.setPersons(persons);
        Object docContent = Base64.getEncoder().encodeToString(bytes);

        details.setDocContent(docContent);
        details.setDataContent(convertJaxbToBase64XmlString(person));
        details.setIssuedTo(issuedTo);
        details.setUri(certUri);
        resp.setResponseStatus(responseStatus);
        resp.setDocDetails(details);
        return resp;
    }


    public static PullDocResponse getDocPullUriResponse(String osId, String status, byte[] bytes, Person person) {
        Object content = convertJaxbToBase64XmlString(person);
        //ResponseStatus
        PullDocResponse resp = new PullDocResponse();
        ResponseStatus responseStatus = new ResponseStatus();
        responseStatus.setStatus(status);
        responseStatus.setTxn(osId);
        responseStatus.setTs(DateUtil.getTimeStamp());
        resp.setResponseStatus(responseStatus);

        DocDetailsRs docDetails = new DocDetailsRs();
        docDetails.setDataContent(content);
        //dataCont.setContent(content);

        docDetails.setDocContent(Base64.getEncoder().encodeToString(bytes));
        resp.setDocDetails(docDetails);
        return resp;
    }
    public static String convertJaxbToString(Object jaxbObject) {
        try {
            JAXBContext jaxbContext = JAXBContext.newInstance(jaxbObject.getClass());
            Marshaller marshaller = jaxbContext.createMarshaller();
            marshaller.setProperty(Marshaller.JAXB_FORMATTED_OUTPUT, true);
            StringWriter writer = new StringWriter();
            marshaller.marshal(jaxbObject, writer);
            String objString = writer.toString();
            return objString;
        } catch (JAXBException e) {
            e.printStackTrace();
            return null;
        }
    }

    public static Object convertJaxbToPullDoc(PullDocResponse jaxbObject) {
        try {
            StringWriter writer = new StringWriter();
            JAXB.marshal(jaxbObject, writer);
            Object objString = writer.toString();
            return objString;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    public static String convertJaxbToBase64XmlString(Object jaxbObject) {
        try {
            JAXBContext jaxbContext = JAXBContext.newInstance(jaxbObject.getClass());
            Marshaller marshaller = jaxbContext.createMarshaller();
            marshaller.setProperty(Marshaller.JAXB_FORMATTED_OUTPUT, true);
            StringWriter writer = new StringWriter();
            marshaller.marshal(jaxbObject, writer);
            String objString = writer.toString();
            String base64 = convertXmlToBase64(objString);
            return base64;
        } catch (JAXBException e) {
            e.printStackTrace();
            return null;
        }
    }

    public static String convertXmlToBase64(String xmlData) {
        byte[] bytes = xmlData.getBytes(StandardCharsets.UTF_8);
        return Base64.getEncoder().encodeToString(bytes);
    }

    public byte[] generateHMAC(byte[] rawData, String key) throws NoSuchAlgorithmException, InvalidKeyException {
        Mac sha256Hmac = Mac.getInstance(HMAC_SHA_256);
        SecretKeySpec secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        sha256Hmac.init(secretKey);
        byte[] hmacData = sha256Hmac.doFinal(rawData);
        return hexEncode(hmacData);
    }

    public static boolean isValidHmac(String receivedHashValue, String secretKey,String data) {
           // Verify the hash value
        return verifyHmac(data, secretKey, receivedHashValue);

    }

    public static boolean verifyHmac(String data, String secretKey, String hmacKey) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(secretKey.getBytes(), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] calculatedHash = mac.doFinal(data.getBytes());
            // Decode the received hash value from Base64
            byte[] receivedHashBytes = Base64.getDecoder().decode(hmacKey);
            // Compare the calculated hash with the received hash
            return MessageDigest.isEqual(calculatedHash, receivedHashBytes);
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    private byte[] hexEncode(byte[] data) {
        char[] hexChars = new char[data.length * 2];
        for (int i = 0; i < data.length; i++) {
            int v = data[i] & 0xFF;
            hexChars[i * 2] = Character.forDigit(v >>> 4, 16);
            hexChars[i * 2 + 1] = Character.forDigit(v & 0x0F, 16);
        }
        return new String(hexChars).getBytes(StandardCharsets.UTF_8);
    }

    public boolean validateHMAC(byte[] actualHMAC, byte[] expectedHMAC) {
        return Arrays.equals(actualHMAC, expectedHMAC);
    }

}
