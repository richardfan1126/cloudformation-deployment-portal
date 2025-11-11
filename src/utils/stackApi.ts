import { StackOutput, StackOutputResponse } from '../types'

// Mock API function to simulate stack output retrieval
// This will be replaced with actual API calls when backend is implemented in task 6
export const fetchStackOutputs = async (_guid: string): Promise<StackOutput[] | null> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Note: Mock data removed for security - frontend should not contain actual Access Codes
    // Real validation and data retrieval should be done server-side

    // Return null for all requests (Access Codes not exposed in frontend)
    return null
}

// Function to validate API response (for future use with real API)
export const validateStackOutputResponse = (response: any): response is StackOutputResponse => {
    return response && Array.isArray(response.outputs)
}

// Function to handle API errors (for future use with real API)
export const handleApiError = (error: any): string => {
    if (error.response?.data?.error) {
        return error.response.data.error
    }
    if (error.message) {
        return error.message
    }
    return 'An unexpected error occurred while retrieving stack outputs'
}