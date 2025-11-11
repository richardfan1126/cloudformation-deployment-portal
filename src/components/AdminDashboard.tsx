import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signOut, getCurrentUser } from 'aws-amplify/auth'
import AccessCodeStatusTable from './AccessCodeStatusTable'
import BatchDeploymentDialog from './BatchDeploymentDialog'
import BatchDeletionControls from './BatchDeletionControls'
import { DeployedStack, AccessCodeStatus } from '../types'
import { deployStacks, deleteStack, getDeletionStatus, deleteAllStacks, getAllDeletionStatus, AccessCodeStatusResponse } from '../utils/apiClient'
import { API_ENDPOINTS } from '../config/api'
import { ValidationUtils, parseApiError, AppError } from '../utils/errorHandling'
import ErrorDisplay from './ErrorDisplay'

const AdminDashboard = () => {
    const navigate = useNavigate()
    const [stackCount, setStackCount] = useState<number>(1)
    const [isDeploying, setIsDeploying] = useState(false)
    const [deploymentStatus, setDeploymentStatus] = useState('')
    const [deploymentError, setDeploymentError] = useState<AppError | null>(null)
    const [validationError, setValidationError] = useState<AppError | null>(null)
    const [apiConfigured, setApiConfigured] = useState(false)
    const [deployedStacks, setDeployedStacks] = useState<DeployedStack[]>([])
    const [assignedAccessCodes, setAssignedAccessCodes] = useState<string[]>([])
    const [username, setUsername] = useState('')
    const [availableAccessCodes, setAvailableAccessCodes] = useState(60)
    const [selectedAccessCode, setSelectedAccessCode] = useState<string | null>(null)
    const [isDeletingStack, setIsDeletingStack] = useState(false)
    const [deletionError, setDeletionError] = useState<AppError | null>(null)
    const [deletionProgress, setDeletionProgress] = useState<string>('')
    const [deletionPollingInterval, setDeletionPollingInterval] = useState<NodeJS.Timeout | null>(null)
    const [forceTableRefresh, setForceTableRefresh] = useState<number>(0)
    const [showBatchDeployDialog, setShowBatchDeployDialog] = useState(false)
    const [batchDeployConfig, setBatchDeployConfig] = useState<{
        stackCount: number
    } | null>(null)
    const [isDeletingAll, setIsDeletingAll] = useState(false)
    const [bulkDeletionError, setBulkDeletionError] = useState<AppError | null>(null)
    const [bulkDeletionProgress, setBulkDeletionProgress] = useState<{ [accessCode: string]: string }>({})
    const [bulkDeletionPollingInterval, setBulkDeletionPollingInterval] = useState<NodeJS.Timeout | null>(null)
    const [accessCodeStatuses, setAccessCodeStatuses] = useState<AccessCodeStatus[]>([])

    useEffect(() => {
        const getUser = async () => {
            try {
                const user = await getCurrentUser()
                setUsername(user.signInDetails?.loginId || 'Admin')
            } catch (error) {
                console.error('Error getting user:', error)
            }
        }
        getUser()

        // Check if API endpoints are configured
        const checkApiConfig = () => {
            const { apiGatewayUrl } = API_ENDPOINTS
            setApiConfigured(!!apiGatewayUrl)
        }
        checkApiConfig()

        // Cleanup polling on unmount
        return () => {
            if (deletionPollingInterval) {
                clearInterval(deletionPollingInterval)
            }
            if (bulkDeletionPollingInterval) {
                clearInterval(bulkDeletionPollingInterval)
            }
        }
    }, [deletionPollingInterval, bulkDeletionPollingInterval])

    const handleSignOut = async () => {
        try {
            await signOut()
            // Redirect to login page after successful logout
            navigate('/admin/login', { replace: true })
        } catch (error) {
            console.error('Error signing out:', error)
            // Even if there's an error, try to redirect to login
            navigate('/admin/login', { replace: true })
        }
    }

    const validateDeploymentForm = (): boolean => {
        const validationError = ValidationUtils.validateStackCount(stackCount, availableAccessCodes)
        setValidationError(validationError)
        return !validationError
    }

    const handleDeploy = async (e: React.FormEvent) => {
        e.preventDefault()

        // Clear previous errors
        setDeploymentError(null)
        setValidationError(null)
        setDeploymentStatus('')

        // Validate form
        if (!validateDeploymentForm()) {
            return
        }

        // Show confirmation dialog for batch deployment
        setBatchDeployConfig({
            stackCount
        })
        setShowBatchDeployDialog(true)
    }

    const handleBatchDeployConfirm = async () => {
        if (!batchDeployConfig) return

        setShowBatchDeployDialog(false)
        setIsDeploying(true)
        setDeployedStacks([])
        setAssignedAccessCodes([])

        try {
            const { stackCount: count } = batchDeployConfig
            setDeploymentStatus(`Initiating deployment of ${count} stack(s) with auto-assignment...`)

            // Call the real API with auto-assignment (no selected Access Codes)
            const response = await deployStacks(count)

            setAssignedAccessCodes(response.assignedAccessCodes)
            setDeployedStacks(response.deployedStacks)
            setAvailableAccessCodes(prev => prev - count)
            setDeploymentStatus(`Successfully initiated deployment of ${count} stack(s)`)

            // Force refresh the Access Code table to show new deployments
            setForceTableRefresh(Date.now())

        } catch (error: any) {
            console.error('Deployment error:', error)
            const parsedError = parseApiError(error)
            setDeploymentError(parsedError)
            setDeploymentStatus('')
        } finally {
            setIsDeploying(false)
            setBatchDeployConfig(null)
        }
    }

    const handleBatchDeployCancel = () => {
        setShowBatchDeployDialog(false)
        setBatchDeployConfig(null)
    }

    const handleRetryDeployment = () => {
        setDeploymentError(null)
        handleDeploy({ preventDefault: () => { } } as React.FormEvent)
    }

    const handleDirectDeploy = async (accessCode: string) => {
        // Clear previous errors
        setDeploymentError(null)
        setValidationError(null)
        setDeploymentStatus('')

        setIsDeploying(true)
        setDeployedStacks([])
        setAssignedAccessCodes([])

        try {
            setDeploymentStatus(`Deploying stack to Access Code ${accessCode}...`)

            // Deploy single stack with specific Access Code
            const response = await deployStacks(1, [accessCode])

            setAssignedAccessCodes(response.assignedAccessCodes)
            setDeployedStacks(response.deployedStacks)
            setAvailableAccessCodes(prev => prev - 1)
            setDeploymentStatus(`Successfully deployed stack to Access Code ${accessCode}`)

            // Force refresh the Access Code table to show new deployment
            setForceTableRefresh(Date.now())

        } catch (error: any) {
            console.error('Direct deployment error:', error)
            const parsedError = parseApiError(error)
            setDeploymentError(parsedError)
            setDeploymentStatus('')
        } finally {
            setIsDeploying(false)
        }
    }



    const handleAccessCodeTableRefresh = (accessCodeData: AccessCodeStatusResponse) => {
        // Update available count when Access Code table refreshes
        setAvailableAccessCodes(accessCodeData.totalAvailable)
        // Store Access Code statuses for BatchDeletionControls
        setAccessCodeStatuses(accessCodeData.accessCodeStatuses)
    }

    const handleRetryDeletion = () => {
        if (selectedAccessCode) {
            setDeletionError(null)
            handleStackDelete(selectedAccessCode)
        }
    }

    const handleAccessCodeSelect = (accessCode: string) => {
        setSelectedAccessCode(accessCode || null)
    }

    const startDeletionPolling = (accessCode: string) => {
        // Clear any existing polling interval
        if (deletionPollingInterval) {
            clearInterval(deletionPollingInterval)
        }

        const pollDeletionStatus = async () => {
            try {
                const statusResponse = await getDeletionStatus(accessCode)
                setDeletionProgress(statusResponse.progress)

                if (statusResponse.isComplete) {
                    // Stop polling when deletion is complete
                    if (deletionPollingInterval) {
                        clearInterval(deletionPollingInterval)
                        setDeletionPollingInterval(null)
                    }
                    setIsDeletingStack(false)
                    setDeletionProgress('')
                    setSelectedAccessCode(null) // Clear selection when deletion completes

                    // Force a refresh of the Access Code table by triggering a manual refresh
                    setForceTableRefresh(Date.now())
                }
            } catch (error) {
                console.error('Error polling deletion status:', error)
                // Continue polling even if there's an error, as it might be temporary
            }
        }

        // Start polling every 3 seconds for faster feedback
        const interval = setInterval(pollDeletionStatus, 3000)
        setDeletionPollingInterval(interval)

        // Also poll immediately
        pollDeletionStatus()
    }



    const handleStackDelete = async (accessCode: string) => {
        setIsDeletingStack(true)
        setDeletionError(null)

        try {
            console.log('Deleting stack for Access Code:', accessCode)

            // Call the real API to delete the stack
            const response = await deleteStack(accessCode)

            if (response.success) {
                console.log('Stack deletion initiated successfully:', response.message)

                // Start polling for deletion progress
                startDeletionPolling(accessCode)

                // Don't clear selection immediately - keep it selected to show progress
                // setSelectedAccessCode(null) - will be cleared when deletion completes

                // The Access Code table will refresh automatically and show the updated status
            } else {
                throw new Error(response.message || 'Stack deletion failed')
            }

        } catch (error: any) {
            console.error('Stack deletion error:', error)

            // Stop any ongoing polling
            if (deletionPollingInterval) {
                clearInterval(deletionPollingInterval)
                setDeletionPollingInterval(null)
            }

            // Parse and enhance error messages for specific scenarios
            let parsedError = parseApiError(error)

            // Enhance error messages for common deletion scenarios
            if (error.message?.includes('DELETE_IN_PROGRESS')) {
                parsedError = {
                    ...parsedError,
                    message: 'Stack is already being deleted. Please wait for the current deletion to complete.',
                    userFriendly: true
                }
            } else if (error.message?.includes('CREATE_IN_PROGRESS')) {
                parsedError = {
                    ...parsedError,
                    message: 'Cannot delete stack while it is still being created. Please wait for creation to complete.',
                    userFriendly: true
                }
            } else if (error.message?.includes('STACK_NOT_FOUND')) {
                parsedError = {
                    ...parsedError,
                    message: 'Stack not found. It may have already been deleted or the Access Code is invalid.',
                    userFriendly: true
                }
            } else if (error.message?.includes('ACCESS_DENIED') || error.message?.includes('UnauthorizedOperation')) {
                parsedError = {
                    ...parsedError,
                    message: 'Insufficient permissions to delete this stack. Please contact your administrator.',
                    userFriendly: true
                }
            }

            setDeletionError(parsedError)
        } finally {
            // Only set isDeletingStack to false if we're not starting polling
            // If polling starts, it will manage this state
            if (!deletionPollingInterval) {
                setIsDeletingStack(false)
            }
        }
    }

    const startBulkDeletionPolling = () => {
        // Clear any existing polling interval
        if (bulkDeletionPollingInterval) {
            clearInterval(bulkDeletionPollingInterval)
        }

        const pollBulkDeletionStatus = async () => {
            try {
                const statusResponse = await getAllDeletionStatus()
                setBulkDeletionProgress(
                    Object.fromEntries(
                        Object.entries(statusResponse.deletionStatuses).map(([accessCode, status]) => [
                            accessCode,
                            status.progress
                        ])
                    )
                )

                // Check if all deletions are complete
                const allComplete = Object.values(statusResponse.deletionStatuses).every(
                    status => status.isComplete
                )

                if (allComplete || Object.keys(statusResponse.deletionStatuses).length === 0) {
                    // Stop polling when all deletions are complete or no stacks remain
                    if (bulkDeletionPollingInterval) {
                        clearInterval(bulkDeletionPollingInterval)
                        setBulkDeletionPollingInterval(null)
                    }
                    setIsDeletingAll(false)
                    setBulkDeletionProgress({})

                    // Force a refresh of the Access Code table
                    setForceTableRefresh(Date.now())
                }
            } catch (error) {
                console.error('Error polling bulk deletion status:', error)
                // Continue polling even if there's an error, as it might be temporary
            }
        }

        // Start polling every 3 seconds for faster feedback
        const interval = setInterval(pollBulkDeletionStatus, 3000)
        setBulkDeletionPollingInterval(interval)

        // Also poll immediately
        pollBulkDeletionStatus()
    }

    const handleDeleteAll = async () => {
        setIsDeletingAll(true)
        setBulkDeletionError(null)
        setBulkDeletionProgress({})

        try {
            console.log('Starting bulk deletion of all stacks')

            // Call the bulk deletion API
            const response = await deleteAllStacks()

            if (response.success) {
                console.log('Bulk deletion initiated successfully:', response.message)

                // Initialize progress tracking for all stacks being deleted
                const initialProgress: { [accessCode: string]: string } = {}
                Object.keys(response.deletionStatuses).forEach(accessCode => {
                    const status = response.deletionStatuses[accessCode]
                    if (status === 'DELETE_INITIATED') {
                        initialProgress[accessCode] = 'Stack deletion initiated...'
                    } else if (status === 'ALREADY_DELETING') {
                        initialProgress[accessCode] = 'Stack deletion already in progress...'
                    } else if (status === 'OPERATION_IN_PROGRESS') {
                        initialProgress[accessCode] = 'Cannot delete - operation in progress'
                    } else if (status === 'DELETE_FAILED') {
                        initialProgress[accessCode] = 'Stack deletion failed'
                    }
                })
                setBulkDeletionProgress(initialProgress)

                // Start polling for bulk deletion progress
                startBulkDeletionPolling()

                // Force refresh the Access Code table to show updated statuses
                setForceTableRefresh(Date.now())

            } else {
                throw new Error(response.message || 'Bulk deletion failed')
            }

        } catch (error: any) {
            console.error('Bulk deletion error:', error)

            // Stop any ongoing polling
            if (bulkDeletionPollingInterval) {
                clearInterval(bulkDeletionPollingInterval)
                setBulkDeletionPollingInterval(null)
            }

            const parsedError = parseApiError(error)
            setBulkDeletionError(parsedError)
            setIsDeletingAll(false)
            setBulkDeletionProgress({})
        }
    }

    const handleRetryBulkDeletion = () => {
        setBulkDeletionError(null)
        handleDeleteAll()
    }

    return (
        <>
            <style>
                {`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}
            </style>
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h1>Admin Dashboard</h1>
                    <div>
                        <span style={{ marginRight: '1rem' }}>Welcome, {username}</span>
                        <button
                            onClick={handleSignOut}
                            style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Sign Out
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <h2>Deploy CloudFormation Stacks</h2>

                    {!apiConfigured && (
                        <div style={{
                            backgroundColor: '#fff3cd',
                            color: '#856404',
                            padding: '1rem',
                            borderRadius: '4px',
                            marginBottom: '1rem',
                            border: '1px solid #ffeaa7'
                        }}>
                            <strong>API Configuration Required:</strong> The backend API endpoints are not configured.
                            Please deploy the Amplify backend and update the environment variables.
                        </div>
                    )}

                    <div style={{
                        backgroundColor: '#f8f9fa',
                        padding: '1rem',
                        borderRadius: '4px',
                        marginBottom: '1rem'
                    }}>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                            <strong>Template:</strong> Configured via deployment-config.json
                        </p>
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
                            <strong>Available Access Codes:</strong> {availableAccessCodes} of {accessCodeStatuses.length || 'N/A'}
                        </p>
                    </div>

                    <form onSubmit={handleDeploy} style={{ marginBottom: '1rem' }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <label htmlFor="stackCount" style={{ display: 'block', marginBottom: '0.5rem' }}>
                                Number of stacks to deploy:
                            </label>
                            <input
                                id="stackCount"
                                type="number"
                                min="1"
                                max={Math.min(60, availableAccessCodes)}
                                value={stackCount}
                                onChange={(e) => {
                                    const newCount = parseInt(e.target.value) || 1
                                    setStackCount(newCount)

                                    if (validationError) {
                                        setValidationError(null)
                                    }
                                }}
                                disabled={isDeploying || availableAccessCodes === 0}
                                style={{
                                    padding: '0.5rem',
                                    fontSize: '1rem',
                                    border: `1px solid ${validationError ? '#dc3545' : '#ccc'}`,
                                    borderRadius: '4px',
                                    width: '100px'
                                }}
                            />
                        </div>



                        <ErrorDisplay
                            error={validationError}
                            showRetryButton={false}
                        />

                        <button
                            type="submit"
                            disabled={!!validationError || isDeploying || availableAccessCodes === 0}
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '1rem',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                opacity: (!!validationError || isDeploying || availableAccessCodes === 0) ? 0.6 : 1
                            }}
                        >
                            {isDeploying ? 'Deploying...' : availableAccessCodes === 0 ? 'No Access Codes Available' : 'Deploy Stacks'}
                        </button>
                    </form>

                    <ErrorDisplay
                        error={deploymentError}
                        onRetry={handleRetryDeployment}
                        showRetryButton={true}
                    />

                    {deploymentStatus && (
                        <div style={{
                            color: '#155724',
                            backgroundColor: '#d4edda',
                            padding: '0.75rem',
                            borderRadius: '4px',
                            marginTop: '1rem'
                        }}>
                            {deploymentStatus}
                        </div>
                    )}

                    {isDeploying && (
                        <div style={{ marginTop: '1rem' }}>
                            <div style={{
                                width: '100%',
                                backgroundColor: '#e9ecef',
                                borderRadius: '4px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: '100%',
                                    height: '20px',
                                    backgroundColor: '#007bff',
                                    animation: 'pulse 1.5s ease-in-out infinite'
                                }} />
                            </div>
                            <p style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                Deployment in progress...
                            </p>
                        </div>
                    )}

                    {assignedAccessCodes.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                            <h4>Assigned Access Codes:</h4>
                            <div style={{
                                backgroundColor: '#f8f9fa',
                                padding: '1rem',
                                borderRadius: '4px',
                                fontFamily: 'monospace',
                                fontSize: '0.9rem'
                            }}>
                                {assignedAccessCodes.map((accessCode, index) => (
                                    <div key={accessCode} style={{ marginBottom: '0.25rem' }}>
                                        {index + 1}. {accessCode}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {deployedStacks.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                            <h4>Deployment Results:</h4>
                            <div style={{
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                overflow: 'hidden'
                            }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f8f9fa' }}>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                                Stack Name
                                            </th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                                Access Code
                                            </th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                                Status
                                            </th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                                Created At
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {deployedStacks.map((stack, index) => (
                                            <tr key={stack.stackId} style={{
                                                backgroundColor: index % 2 === 0 ? '#fff' : '#f8f9fa'
                                            }}>
                                                <td style={{
                                                    padding: '0.75rem',
                                                    borderBottom: '1px solid #eee',
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.8rem'
                                                }}>
                                                    {stack.stackName}
                                                </td>
                                                <td style={{
                                                    padding: '0.75rem',
                                                    borderBottom: '1px solid #eee',
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.8rem'
                                                }}>
                                                    {stack.uniqueId}
                                                </td>
                                                <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>
                                                    <span style={{
                                                        padding: '0.25rem 0.5rem',
                                                        backgroundColor:
                                                            stack.status === 'CREATE_COMPLETE' || stack.status === 'UPDATE_COMPLETE' ? '#28a745' :
                                                                stack.status === 'CREATE_IN_PROGRESS' || stack.status === 'UPDATE_IN_PROGRESS' ? '#ffc107' :
                                                                    stack.status === 'ROLLBACK_IN_PROGRESS' || stack.status === 'UPDATE_ROLLBACK_IN_PROGRESS' ? '#fd7e14' :
                                                                        stack.status === 'DELETE_IN_PROGRESS' ? '#fd7e14' :
                                                                            stack.status?.includes('FAILED') || stack.status?.includes('ROLLBACK_COMPLETE') ? '#dc3545' :
                                                                                stack.status === 'REVIEW_IN_PROGRESS' ? '#6c757d' : '#dc3545',
                                                        color: 'white',
                                                        borderRadius: '4px',
                                                        fontSize: '0.8rem'
                                                    }}>
                                                        {stack.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>
                                                    {stack.createdAt.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <h2>Access Code Management</h2>

                    <ErrorDisplay
                        error={deletionError}
                        onRetry={handleRetryDeletion}
                        showRetryButton={!!selectedAccessCode && !!deletionError}
                    />

                    <ErrorDisplay
                        error={bulkDeletionError}
                        onRetry={handleRetryBulkDeletion}
                        showRetryButton={!!bulkDeletionError}
                    />

                    {isDeletingStack && deletionProgress && (
                        <div style={{
                            backgroundColor: '#e3f2fd',
                            color: '#1976d2',
                            padding: '1rem',
                            borderRadius: '4px',
                            marginBottom: '1rem',
                            border: '1px solid #bbdefb'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{
                                    width: '20px',
                                    height: '20px',
                                    border: '2px solid #1976d2',
                                    borderTop: '2px solid transparent',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                <strong>Stack Deletion in Progress</strong>
                            </div>
                            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                                {deletionProgress}
                            </p>
                        </div>
                    )}

                    {isDeletingAll && (
                        <div style={{
                            backgroundColor: '#fff3cd',
                            color: '#856404',
                            padding: '1rem',
                            borderRadius: '4px',
                            marginBottom: '1rem',
                            border: '1px solid #ffeaa7'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{
                                    width: '20px',
                                    height: '20px',
                                    border: '2px solid #856404',
                                    borderTop: '2px solid transparent',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                <strong>Bulk Stack Deletion in Progress</strong>
                            </div>
                            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                                Deleting all active stacks. This may take several minutes. Individual progress is shown in the table below.
                            </p>
                            {Object.keys(bulkDeletionProgress).length > 0 && (
                                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                                    Progress: {Object.keys(bulkDeletionProgress).length} stack(s) being processed
                                </p>
                            )}
                        </div>
                    )}

                    <BatchDeletionControls
                        guidStatuses={accessCodeStatuses}
                        onDeleteAll={handleDeleteAll}
                        isDeletingAll={isDeletingAll}
                    />

                    <AccessCodeStatusTable
                        onRefresh={handleAccessCodeTableRefresh}
                        selectedAccessCode={selectedAccessCode}
                        onAccessCodeSelect={handleAccessCodeSelect}
                        onStackDelete={handleStackDelete}
                        onStackDeploy={handleDirectDeploy}
                        isDeletingStack={isDeletingStack}
                        isDeployingStack={isDeploying}
                        forceRefresh={forceTableRefresh}
                        isDeletingAll={isDeletingAll}
                        bulkDeletionProgress={bulkDeletionProgress}
                    />
                </div>

                <div style={{ textAlign: 'center' }}>
                    <Link to="/" style={{ color: '#007bff', textDecoration: 'none' }}>
                        ← Back to Public Portal
                    </Link>
                </div>

                <BatchDeploymentDialog
                    isOpen={showBatchDeployDialog}
                    stackCount={batchDeployConfig?.stackCount || 0}
                    selectedGuids={undefined}
                    useGuidSelection={false}
                    onConfirm={handleBatchDeployConfirm}
                    onCancel={handleBatchDeployCancel}
                    isDeploying={isDeploying}
                />
            </div>
        </>
    )
}

export default AdminDashboard