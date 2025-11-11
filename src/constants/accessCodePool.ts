// Note: Access Codes are managed server-side for security
// Frontend should not contain actual Access Codes
// Access Code pool is dynamically loaded from DynamoDB by backend services

// Validation function for Access Code format (UUID v4)
export const validateAccessCodeFormat = (accessCode: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(accessCode);
};

// Check if Access Code has valid UUID format
// Note: Only validates format, not actual pool membership (done server-side for security)
export const isValidAccessCode = (accessCode: string): boolean => {
    // Validate Access Code format using regex
    return validateAccessCodeFormat(accessCode);
};
