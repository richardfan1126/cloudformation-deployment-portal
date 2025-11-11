import { useState, useEffect } from 'react'
import { Navigate, Link, useNavigate } from 'react-router-dom'
import { signIn, getCurrentUser, confirmSignIn } from 'aws-amplify/auth'
import { ValidationUtils, parseApiError, AppError } from '../utils/errorHandling'
import ErrorDisplay from './ErrorDisplay'

const AdminLogin = () => {
    const navigate = useNavigate()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<AppError | null>(null)
    const [validationErrors, setValidationErrors] = useState<{ username?: string; password?: string; newPassword?: string; confirmPassword?: string }>({})
    const [isLoading, setIsLoading] = useState(false)
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
    const [showPasswordChange, setShowPasswordChange] = useState(false)
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    useEffect(() => {
        const checkAuth = async () => {
            try {
                await getCurrentUser()
                setIsAuthenticated(true)
            } catch {
                setIsAuthenticated(false)
            }
        }
        checkAuth()
    }, [])

    // If already authenticated, redirect to admin dashboard
    if (isAuthenticated === true) {
        return <Navigate to="/admin" replace />
    }

    const validateForm = (): boolean => {
        const errors: { username?: string; password?: string } = {}

        const usernameError = ValidationUtils.validateCredentials(username, password)
        if (usernameError && usernameError.message.includes('Username')) {
            errors.username = usernameError.message
        }
        if (usernameError && usernameError.message.includes('Password')) {
            errors.password = usernameError.message
        }

        setValidationErrors(errors)
        return Object.keys(errors).length === 0
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()

        // Clear previous errors
        setError(null)
        setValidationErrors({})

        // Validate form
        if (!validateForm()) {
            return
        }

        setIsLoading(true)

        try {
            const result = await signIn({ username, password })

            // Check if sign in is complete
            if (result.isSignedIn) {
                navigate('/admin', { replace: true })
            } else {
                // Handle multi-step authentication if needed
                if (result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
                    setShowPasswordChange(true)
                    setError(null) // Clear any previous errors
                } else if (result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
                    setError(new AppError({
                        message: 'MFA code required. This feature is not yet implemented.',
                        code: 'MFA_REQUIRED',
                        retryable: false,
                        userFriendly: true
                    }))
                } else {
                    setError(new AppError({
                        message: `Additional authentication step required: ${result.nextStep.signInStep}`,
                        code: 'ADDITIONAL_AUTH_REQUIRED',
                        retryable: false,
                        userFriendly: true
                    }))
                }
            }
        } catch (err: any) {
            console.error('Login error:', err)

            // Parse authentication errors
            let authError: AppError

            if (err.name === 'NotAuthorizedException' || err.message?.includes('Incorrect username or password')) {
                authError = new AppError({
                    message: 'Invalid username or password. Please check your credentials and try again.',
                    code: 'INVALID_CREDENTIALS',
                    retryable: false,
                    userFriendly: true
                })
            } else if (err.name === 'UserNotConfirmedException') {
                authError = new AppError({
                    message: 'Your account has not been confirmed. Please contact your administrator.',
                    code: 'USER_NOT_CONFIRMED',
                    retryable: false,
                    userFriendly: true
                })
            } else if (err.name === 'UserNotFoundException') {
                authError = new AppError({
                    message: 'User not found. Please check your username and try again.',
                    code: 'USER_NOT_FOUND',
                    retryable: false,
                    userFriendly: true
                })
            } else if (err.name === 'TooManyRequestsException') {
                authError = new AppError({
                    message: 'Too many login attempts. Please wait a few minutes and try again.',
                    code: 'TOO_MANY_REQUESTS',
                    retryable: true,
                    userFriendly: true
                })
            } else {
                authError = parseApiError(err)
            }

            setError(authError)
        } finally {
            setIsLoading(false)
        }
    }

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault()

        // Clear previous errors
        setError(null)
        setValidationErrors({})

        // Validate new password
        const errors: { newPassword?: string; confirmPassword?: string } = {}

        if (!newPassword || newPassword.length < 8) {
            errors.newPassword = 'Password must be at least 8 characters long'
        }

        if (newPassword !== confirmPassword) {
            errors.confirmPassword = 'Passwords do not match'
        }

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors)
            return
        }

        setIsLoading(true)

        try {
            const result = await confirmSignIn({ challengeResponse: newPassword })

            if (result.isSignedIn) {
                navigate('/admin', { replace: true })
            } else {
                setError(new AppError({
                    message: `Additional authentication step required: ${result.nextStep.signInStep}`,
                    code: 'ADDITIONAL_AUTH_REQUIRED',
                    retryable: false,
                    userFriendly: true
                }))
            }
        } catch (err: any) {
            const authError = parseApiError(err)
            setError(authError)
        } finally {
            setIsLoading(false)
        }
    }

    const handleRetryLogin = () => {
        setError(null)
        handleLogin({ preventDefault: () => { } } as React.FormEvent)
    }

    if (isAuthenticated === null) {
        return <div>Loading...</div>
    }

    // Show password change form if required
    if (showPasswordChange) {
        return (
            <div style={{ maxWidth: '400px', margin: '0 auto', padding: '2rem' }}>
                <h1>Set New Password</h1>
                <p style={{ marginBottom: '1.5rem', color: '#666' }}>
                    You need to set a new password to complete your login.
                </p>

                <form onSubmit={handlePasswordChange} style={{ marginBottom: '2rem' }}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label htmlFor="newPassword" style={{ display: 'block', marginBottom: '0.5rem' }}>
                            New Password:
                        </label>
                        <input
                            id="newPassword"
                            type="password"
                            value={newPassword}
                            onChange={(e) => {
                                setNewPassword(e.target.value)
                                if (validationErrors.newPassword) {
                                    setValidationErrors(prev => ({ ...prev, newPassword: undefined }))
                                }
                            }}
                            required
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                fontSize: '1rem',
                                border: `1px solid ${validationErrors.newPassword ? '#dc3545' : '#ccc'}`,
                                borderRadius: '4px'
                            }}
                        />
                        {validationErrors.newPassword && (
                            <div style={{ color: '#dc3545', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                                {validationErrors.newPassword}
                            </div>
                        )}
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label htmlFor="confirmPassword" style={{ display: 'block', marginBottom: '0.5rem' }}>
                            Confirm New Password:
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => {
                                setConfirmPassword(e.target.value)
                                if (validationErrors.confirmPassword) {
                                    setValidationErrors(prev => ({ ...prev, confirmPassword: undefined }))
                                }
                            }}
                            required
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                fontSize: '1rem',
                                border: `1px solid ${validationErrors.confirmPassword ? '#dc3545' : '#ccc'}`,
                                borderRadius: '4px'
                            }}
                        />
                        {validationErrors.confirmPassword && (
                            <div style={{ color: '#dc3545', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                                {validationErrors.confirmPassword}
                            </div>
                        )}
                    </div>

                    <ErrorDisplay
                        error={error}
                        onRetry={() => setError(null)}
                        showRetryButton={false}
                    />

                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '0.5rem',
                            fontSize: '1rem',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            opacity: isLoading ? 0.6 : 1
                        }}
                    >
                        {isLoading ? 'Setting Password...' : 'Set New Password'}
                    </button>
                </form>

                <div style={{ textAlign: 'center' }}>
                    <button
                        onClick={() => {
                            setShowPasswordChange(false)
                            setNewPassword('')
                            setConfirmPassword('')
                            setError(null)
                        }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#007bff',
                            textDecoration: 'underline',
                            cursor: 'pointer'
                        }}
                    >
                        ← Back to Login
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div style={{ maxWidth: '400px', margin: '0 auto', padding: '2rem' }}>
            <h1>Admin Login</h1>

            <form onSubmit={handleLogin} style={{ marginBottom: '2rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="username" style={{ display: 'block', marginBottom: '0.5rem' }}>
                        Username:
                    </label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value)
                            if (validationErrors.username) {
                                setValidationErrors(prev => ({ ...prev, username: undefined }))
                            }
                        }}
                        required
                        style={{
                            width: '100%',
                            padding: '0.5rem',
                            fontSize: '1rem',
                            border: `1px solid ${validationErrors.username ? '#dc3545' : '#ccc'}`,
                            borderRadius: '4px'
                        }}
                    />
                    {validationErrors.username && (
                        <div style={{ color: '#dc3545', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                            {validationErrors.username}
                        </div>
                    )}
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem' }}>
                        Password:
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value)
                            if (validationErrors.password) {
                                setValidationErrors(prev => ({ ...prev, password: undefined }))
                            }
                        }}
                        required
                        style={{
                            width: '100%',
                            padding: '0.5rem',
                            fontSize: '1rem',
                            border: `1px solid ${validationErrors.password ? '#dc3545' : '#ccc'}`,
                            borderRadius: '4px'
                        }}
                    />
                    {validationErrors.password && (
                        <div style={{ color: '#dc3545', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                            {validationErrors.password}
                        </div>
                    )}
                </div>

                <ErrorDisplay
                    error={error}
                    onRetry={handleRetryLogin}
                    showRetryButton={true}
                />

                <button
                    type="submit"
                    disabled={isLoading}
                    style={{
                        width: '100%',
                        padding: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        opacity: isLoading ? 0.6 : 1
                    }}
                >
                    {isLoading ? 'Signing In...' : 'Sign In'}
                </button>
            </form>

            <div style={{ textAlign: 'center' }}>
                <Link to="/" style={{ color: '#007bff', textDecoration: 'none' }}>
                    ← Back to Public Portal
                </Link>
            </div>
        </div>
    )
}

export default AdminLogin