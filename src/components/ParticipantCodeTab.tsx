import React, { useState, useEffect } from 'react'
import { validateAccessCodeFormat, isValidAccessCode } from '../constants/accessCodePool'
import { StackOutput } from '../types'
import { getStackOutputs } from '../utils/apiClient'
import OutputDisplay from './OutputDisplay'
import { ValidationUtils, parseApiError, AppError } from '../utils/errorHandling'
import ErrorDisplay from './ErrorDisplay'
import GuidelinesSection from './GuidelinesSection'

interface ParticipantCodeTabProps {
    // No props needed since guidelines are now always expanded
}

interface GuidelineStep {
    stepNumber: number
    title: string
    description: string
    screenshotUrl?: string
    screenshotAlt?: string
}

// Persistent state keys for localStorage
const STORAGE_KEYS = {
    UNIQUE_ID: 'accessCode_uniqueId',
    OUTPUTS: 'accessCode_outputs',
    SEARCH_PERFORMED: 'accessCode_searchPerformed',
    NOT_FOUND: 'accessCode_notFound',
    SEARCHED_ACCESS_CODE: 'accessCode_searchedAccessCode'
}

// Session key to track page refresh
const SESSION_KEY = 'accessCode_sessionActive'

// Helper functions for localStorage
const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
    try {
        const stored = localStorage.getItem(key)
        return stored ? JSON.parse(stored) : defaultValue
    } catch {
        return defaultValue
    }
}

const saveToStorage = <T,>(key: string, value: T): void => {
    try {
        localStorage.setItem(key, JSON.stringify(value))
    } catch {
        // Ignore storage errors
    }
}



const ParticipantCodeTab: React.FC<ParticipantCodeTabProps> = () => {
    // Initialize state with empty values first, then load from storage if session is active
    const [uniqueId, setUniqueId] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<AppError | null>(null)
    const [outputs, setOutputs] = useState<StackOutput[]>([])
    const [validationError, setValidationError] = useState<AppError | null>(null)
    const [searchPerformed, setSearchPerformed] = useState(false)
    const [searchedAccessCode, setSearchedAccessCode] = useState('')

    // Handle localStorage clearing and loading on component mount
    useEffect(() => {
        try {
            // Check if this is a fresh page load (sessionStorage is cleared on page refresh)
            const sessionActive = sessionStorage.getItem(SESSION_KEY)

            if (!sessionActive) {
                // This is a fresh page load, clear all Access Code localStorage
                Object.values(STORAGE_KEYS).forEach(key => {
                    localStorage.removeItem(key)
                })

                // Mark session as active to prevent clearing on tab switches
                sessionStorage.setItem(SESSION_KEY, 'true')

                // Keep all state as empty (already initialized above)
            } else {
                // Session is active, load from localStorage
                setUniqueId(loadFromStorage(STORAGE_KEYS.UNIQUE_ID, ''))
                setOutputs(loadFromStorage(STORAGE_KEYS.OUTPUTS, []))
                setSearchPerformed(loadFromStorage(STORAGE_KEYS.SEARCH_PERFORMED, false))
                setSearchedAccessCode(loadFromStorage(STORAGE_KEYS.SEARCHED_ACCESS_CODE, ''))
            }
        } catch {
            // Ignore storage errors
        }
    }, [])

    const accessCodeGuidelines: GuidelineStep[] = [
        {
            stepNumber: 1,
            title: 'Obtain Access Code',
            description: 'Get your Access Code from the system administrator.<br>This code gives you access to your deployed stack outputs.'
        },
        {
            stepNumber: 2,
            title: 'Enter Access Code',
            description: 'Type your Access Code into the input field above.<br>The code should be in the format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.',
            screenshotUrl: '/assets/screenshots/participant-code-input.png',
            screenshotAlt: 'Access Code input field'
        },
        {
            stepNumber: 3,
            title: 'View Stack Outputs',
            description: 'Click "View Stack Outputs" to retrieve your deployment information.<br>This will show you the outputs from your CloudFormation stack.',
            screenshotUrl: '/assets/screenshots/participant-code-results.png',
            screenshotAlt: 'Stack outputs display'
        }
    ]

    const validateSearchForm = (): boolean => {
        // Clear previous validation errors
        setValidationError(null)

        // Validate Access Code format
        const formatError = ValidationUtils.validateGuidFormat(uniqueId)
        if (formatError) {
            setValidationError(formatError)
            return false
        }

        // Validate Access Code format (pool membership is validated server-side)
        if (!isValidAccessCode(uniqueId)) {
            setValidationError(new AppError({
                message: 'The entered Access Code format is invalid.',
                code: 'INVALID_ACCESS_CODE_FORMAT',
                retryable: false,
                userFriendly: true
            }))
            return false
        }

        return true
    }

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()

        // Only clear previous results and errors when user clicks again
        // This preserves the Access Code results in the public view
        setError(null)
        setOutputs([])
        setValidationError(null)
        setSearchPerformed(false)
        setSearchedAccessCode('')

        // Clear localStorage when user explicitly searches again
        saveToStorage(STORAGE_KEYS.OUTPUTS, [])
        saveToStorage(STORAGE_KEYS.SEARCH_PERFORMED, false)
        saveToStorage(STORAGE_KEYS.NOT_FOUND, false)
        saveToStorage(STORAGE_KEYS.SEARCHED_ACCESS_CODE, '')

        // Validate form
        if (!validateSearchForm()) {
            return
        }

        setLoading(true)

        try {
            console.log('Searching for stack outputs with Access Code:', uniqueId)

            const response = await getStackOutputs(uniqueId)

            setSearchPerformed(true)
            setOutputs(response.outputs)
            setSearchedAccessCode(uniqueId) // Store the Access Code that was actually searched

            // Save results to localStorage for persistence across tab switches
            saveToStorage(STORAGE_KEYS.SEARCH_PERFORMED, true)
            saveToStorage(STORAGE_KEYS.OUTPUTS, response.outputs)
            saveToStorage(STORAGE_KEYS.NOT_FOUND, false)
            saveToStorage(STORAGE_KEYS.SEARCHED_ACCESS_CODE, uniqueId)
        } catch (err: any) {
            console.error('Error fetching stack outputs:', err)

            setSearchPerformed(true)
            saveToStorage(STORAGE_KEYS.SEARCH_PERFORMED, true)
            const parsedError = parseApiError(err)

            if (parsedError.code === 'STACK_NOT_FOUND' || err.message.includes('not found') || err.message.includes('404')) {
                setSearchedAccessCode(uniqueId) // Store the Access Code that was searched (even if not found)
                saveToStorage(STORAGE_KEYS.NOT_FOUND, true)
                saveToStorage(STORAGE_KEYS.SEARCHED_ACCESS_CODE, uniqueId)
            } else if (parsedError.code === 'STACK_ERROR_STATE') {
                // Handle stack error states specifically
                setError(new AppError({
                    message: 'The stack is in an error state and outputs are not available. Please contact the administrator.',
                    code: 'STACK_ERROR_STATE',
                    retryable: false,
                    userFriendly: true
                }))
            } else {
                setError(parsedError)
            }
        } finally {
            setLoading(false)
        }
    }

    const handleRetrySearch = () => {
        setError(null)
        handleSearch({ preventDefault: () => { } } as React.FormEvent)
    }

    const validateUniqueId = (id: string) => {
        return validateAccessCodeFormat(id) && isValidAccessCode(id)
    }

    const formatAccessCode = (input: string): string => {
        // Remove all non-alphanumeric characters
        const cleaned = input.replace(/[^a-f0-9]/gi, '').toLowerCase()

        // Limit to 32 characters (without hyphens)
        const limited = cleaned.slice(0, 32)

        // Add hyphens at appropriate positions: 8-4-4-4-12
        let formatted = ''
        for (let i = 0; i < limited.length; i++) {
            if (i === 8 || i === 12 || i === 16 || i === 20) {
                formatted += '-'
            }
            formatted += limited[i]
        }

        return formatted
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value
        const formattedValue = formatAccessCode(rawValue)

        setUniqueId(formattedValue)
        saveToStorage(STORAGE_KEYS.UNIQUE_ID, formattedValue)
        setError(null)
        setValidationError(null)
        // Don't clear outputs, searchPerformed, or notFound to preserve Access Code results
        // Results will only be cleared when user clicks "View Stack Outputs" again
    }

    // State is now persisted in localStorage and survives tab switches
    // No cleanup needed as we want to preserve Access Code and results

    return (
        <div
            role="tabpanel"
            id="participant-code-panel"
            aria-labelledby="participant-code-tab"
        >
            <p>Enter the Access Code to view stack outputs</p>

            <form onSubmit={handleSearch} style={{ marginBottom: '2rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="guid-input" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                        Access Code:
                    </label>
                    <input
                        id="guid-input"
                        type="text"
                        value={uniqueId}
                        onChange={handleInputChange}
                        placeholder="Enter Access Code (e.g., xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)"
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            fontSize: '1rem',
                            border: `1px solid ${validationError ? '#dc3545' : '#ccc'}`,
                            borderRadius: '4px',
                            boxSizing: 'border-box'
                        }}
                        maxLength={36}
                        autoComplete="off"
                    />
                    {/* Real-time validation feedback */}
                    {uniqueId && !validateAccessCodeFormat(uniqueId) && (
                        <p style={{ color: '#ffc107', fontSize: '0.9rem', marginTop: '0.5rem', marginBottom: '0' }}>
                            Please enter a valid Access Code format (8-4-4-4-12 characters)
                        </p>
                    )}
                    {uniqueId && validateAccessCodeFormat(uniqueId) && !isValidAccessCode(uniqueId) && (
                        <p style={{ color: '#ffc107', fontSize: '0.9rem', marginTop: '0.5rem', marginBottom: '0' }}>
                            This Access Code format is invalid
                        </p>
                    )}
                    {uniqueId && validateUniqueId(uniqueId) && (
                        <p style={{ color: '#28a745', fontSize: '0.9rem', marginTop: '0.5rem', marginBottom: '0' }}>
                            ✓ Valid Access Code format
                        </p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={!uniqueId || !validateUniqueId(uniqueId) || loading}
                    style={{
                        padding: '0.75rem 1.5rem',
                        fontSize: '1rem',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        opacity: (!uniqueId || !validateUniqueId(uniqueId) || loading) ? 0.6 : 1,
                        transition: 'opacity 0.2s'
                    }}
                >
                    {loading ? 'Searching...' : 'View Stack Outputs'}
                </button>
            </form>

            <ErrorDisplay
                error={validationError}
                showRetryButton={false}
            />

            <ErrorDisplay
                error={error}
                onRetry={handleRetrySearch}
                showRetryButton={true}
            />

            {/* Display results after search is performed */}
            {searchPerformed && !loading && !error && (
                <OutputDisplay outputs={outputs} guid={searchedAccessCode} />
            )}

            <GuidelinesSection
                title="Step-by-step Guidelines"
                guidelines={accessCodeGuidelines}
                tabType="participant-code"
            />
        </div>
    )
}

export default ParticipantCodeTab