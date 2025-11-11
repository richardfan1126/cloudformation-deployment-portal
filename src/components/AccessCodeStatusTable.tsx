import { useState, useEffect } from 'react'
import { AccessCodeStatus } from '../types'
import { getAccessCodeStatuses, AccessCodeStatusResponse } from '../utils/apiClient'
import { parseApiError, AppError } from '../utils/errorHandling'
import ErrorDisplay from './ErrorDisplay'
import StackDeletionDialog from './StackDeletionDialog'
import StackDeploymentDialog from './StackDeploymentDialog'

interface AccessCodeStatusTableProps {
    onRefresh?: (accessCodeData: AccessCodeStatusResponse) => void;
    selectedAccessCode?: string | null;
    onAccessCodeSelect?: (accessCode: string) => void;
    onStackDelete?: (accessCode: string) => void;
    onStackDeploy?: (accessCode: string) => void;
    isDeletingStack?: boolean;
    isDeployingStack?: boolean;
    forceRefresh?: number; // Timestamp to force refresh
    isDeletingAll?: boolean;
    bulkDeletionProgress?: { [accessCode: string]: string };
}

const AccessCodeStatusTable = ({
    onRefresh,
    selectedAccessCode,
    onAccessCodeSelect,
    onStackDelete,
    onStackDeploy,
    isDeletingStack = false,
    isDeployingStack = false,
    forceRefresh,
    isDeletingAll = false,
    bulkDeletionProgress = {}
}: AccessCodeStatusTableProps) => {
    const [accessCodeStatuses, setAccessCodeStatuses] = useState<AccessCodeStatus[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<AppError | null>(null)
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
    const [showDeletionDialog, setShowDeletionDialog] = useState(false)
    const [accessCodeToDelete, setAccessCodeToDelete] = useState<AccessCodeStatus | null>(null)
    const [showDeploymentDialog, setShowDeploymentDialog] = useState(false)
    const [accessCodeToDeploy, setAccessCodeToDeploy] = useState<AccessCodeStatus | null>(null)
    const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null)
    const [previousAccessCodeStatuses, setPreviousAccessCodeStatuses] = useState<AccessCodeStatus[]>([])

    const loadAccessCodeStatuses = async () => {
        setIsLoading(true)
        setError(null)

        try {
            // Call the real API
            const response = await getAccessCodeStatuses()

            setAccessCodeStatuses(response.accessCodeStatuses)
            setPreviousAccessCodeStatuses(accessCodeStatuses) // Store previous state for comparison
            setLastRefresh(new Date())

            if (onRefresh) {
                onRefresh(response)
            }
        } catch (err: any) {
            console.error('Error loading Access Code statuses:', err)
            const parsedError = parseApiError(err)
            setError(parsedError)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadAccessCodeStatuses()
    }, [])

    // Force refresh when deletion state changes
    useEffect(() => {
        if (!isDeletingStack && selectedAccessCode) {
            // When deletion completes, refresh the table
            loadAccessCodeStatuses()
        }
    }, [isDeletingStack, selectedAccessCode])

    // Force refresh when parent requests it
    useEffect(() => {
        if (forceRefresh) {
            loadAccessCodeStatuses()
        }
    }, [forceRefresh])

    // Detect status changes and trigger additional refresh if needed
    useEffect(() => {
        if (previousAccessCodeStatuses.length > 0 && accessCodeStatuses.length > 0) {
            const statusChanges = accessCodeStatuses.some((current, index) => {
                const previous = previousAccessCodeStatuses[index]
                if (!previous) return false

                // Check for significant status transitions
                return (
                    current.status !== previous.status ||
                    current.isLinked !== previous.isLinked
                )
            })

            // If we detected status changes and there are still in-progress operations,
            // schedule another refresh to catch rapid state transitions
            if (statusChanges) {
                const inProgressStates = [
                    'CREATE_IN_PROGRESS',
                    'ROLLBACK_IN_PROGRESS',
                    'UPDATE_IN_PROGRESS',
                    'UPDATE_ROLLBACK_IN_PROGRESS',
                    'DELETE_IN_PROGRESS',
                    'REVIEW_IN_PROGRESS'
                ]

                const hasInProgress = accessCodeStatuses.some(status =>
                    inProgressStates.includes(status.status || '')
                )

                if (hasInProgress) {
                    // Schedule a refresh in 2 seconds to catch rapid transitions
                    setTimeout(() => {
                        loadAccessCodeStatuses()
                    }, 2000)
                }
            }
        }
    }, [accessCodeStatuses, previousAccessCodeStatuses])

    // Auto-refresh when there are stacks in progress
    useEffect(() => {
        const inProgressStates = [
            'CREATE_IN_PROGRESS',
            'ROLLBACK_IN_PROGRESS',
            'UPDATE_IN_PROGRESS',
            'UPDATE_ROLLBACK_IN_PROGRESS',
            'DELETE_IN_PROGRESS',
            'REVIEW_IN_PROGRESS'
        ]

        const hasStacksInProgress = accessCodeStatuses.some(status =>
            inProgressStates.includes(status.status || '')
        )

        if (hasStacksInProgress && !autoRefreshInterval) {
            // Start auto-refresh every 5 seconds for faster updates
            const interval = setInterval(() => {
                loadAccessCodeStatuses()
            }, 5000)
            setAutoRefreshInterval(interval)
        } else if (!hasStacksInProgress && autoRefreshInterval) {
            // Stop auto-refresh when no stacks are in progress
            clearInterval(autoRefreshInterval)
            setAutoRefreshInterval(null)
        }

        // Cleanup on unmount
        return () => {
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval)
            }
        }
    }, [accessCodeStatuses, autoRefreshInterval])

    const handleRefresh = () => {
        setError(null)
        loadAccessCodeStatuses()
    }

    const handleDeleteClick = (accessCodeStatus: AccessCodeStatus) => {
        if (onAccessCodeSelect) {
            onAccessCodeSelect(accessCodeStatus.accessCode)
        }
        setAccessCodeToDelete(accessCodeStatus)
        setShowDeletionDialog(true)
    }

    const handleDeployClick = (accessCodeStatus: AccessCodeStatus) => {
        if (onAccessCodeSelect) {
            onAccessCodeSelect(accessCodeStatus.accessCode)
        }
        setAccessCodeToDeploy(accessCodeStatus)
        setShowDeploymentDialog(true)
    }

    const handleDeployConfirm = () => {
        if (accessCodeToDeploy && onStackDeploy) {
            onStackDeploy(accessCodeToDeploy.accessCode)
            setShowDeploymentDialog(false)
            setAccessCodeToDeploy(null)
        }
    }

    const handleDeployCancel = () => {
        setShowDeploymentDialog(false)
        setAccessCodeToDeploy(null)
        if (onAccessCodeSelect) {
            onAccessCodeSelect('')
        }
    }

    const handleDeleteConfirm = () => {
        if (accessCodeToDelete && onStackDelete) {
            onStackDelete(accessCodeToDelete.accessCode)
            setShowDeletionDialog(false)
            setAccessCodeToDelete(null)
        }
    }

    const handleDeleteCancel = () => {
        setShowDeletionDialog(false)
        setAccessCodeToDelete(null)
        if (onAccessCodeSelect) {
            onAccessCodeSelect('')
        }
    }

    const isAccessCodeDeletable = (status: AccessCodeStatus): boolean => {
        if (!status.isLinked) {
            return false
        }

        // Prevent deletion of stacks that are currently in progress
        const inProgressStates = [
            'CREATE_IN_PROGRESS',
            'ROLLBACK_IN_PROGRESS',
            'UPDATE_IN_PROGRESS',
            'UPDATE_ROLLBACK_IN_PROGRESS',
            'DELETE_IN_PROGRESS',
            'REVIEW_IN_PROGRESS'
        ]

        if (inProgressStates.includes(status.status || '')) {
            return false
        }

        // Allow deletion of completed, failed, or other stable states
        return true
    }

    const isAccessCodeDeployable = (status: AccessCodeStatus): boolean => {
        // Only available (unlinked) Access Codes can be deployed
        return !status.isLinked
    }

    const availableCount = accessCodeStatuses.filter(status => !status.isLinked).length
    const linkedCount = accessCodeStatuses.filter(status => status.isLinked).length

    const formatDate = (date: Date | undefined) => {
        if (!date) return '-'
        return date.toLocaleString()
    }

    const getStatusBadge = (status: AccessCodeStatus) => {
        if (!status.isLinked) {
            return (
                <span style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#28a745',
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '0.8rem'
                }}>
                    Available
                </span>
            )
        }

        let statusColor = '#007bff'
        let statusText = 'Linked'
        let showSpinner = false

        switch (status.status) {
            case 'CREATE_IN_PROGRESS':
                statusColor = '#ffc107'
                statusText = 'Creating'
                showSpinner = true
                break
            case 'CREATE_COMPLETE':
                statusColor = '#007bff'
                statusText = 'Active'
                break
            case 'CREATE_FAILED':
                statusColor = '#dc3545'
                statusText = 'Create Failed'
                break
            case 'ROLLBACK_IN_PROGRESS':
                statusColor = '#fd7e14'
                statusText = 'Rolling Back'
                showSpinner = true
                break
            case 'ROLLBACK_COMPLETE':
                statusColor = '#dc3545'
                statusText = 'Rollback Complete'
                break
            case 'ROLLBACK_FAILED':
                statusColor = '#dc3545'
                statusText = 'Rollback Failed'
                break
            case 'UPDATE_IN_PROGRESS':
                statusColor = '#17a2b8'
                statusText = 'Updating'
                showSpinner = true
                break
            case 'UPDATE_COMPLETE':
                statusColor = '#007bff'
                statusText = 'Active'
                break
            case 'UPDATE_FAILED':
                statusColor = '#dc3545'
                statusText = 'Update Failed'
                break
            case 'UPDATE_ROLLBACK_IN_PROGRESS':
                statusColor = '#fd7e14'
                statusText = 'Update Rollback'
                showSpinner = true
                break
            case 'UPDATE_ROLLBACK_COMPLETE':
                statusColor = '#dc3545'
                statusText = 'Update Rollback Complete'
                break
            case 'UPDATE_ROLLBACK_FAILED':
                statusColor = '#dc3545'
                statusText = 'Update Rollback Failed'
                break
            case 'DELETE_IN_PROGRESS':
                statusColor = '#fd7e14'
                statusText = 'Deleting'
                showSpinner = true
                break
            case 'DELETE_COMPLETE':
                // This should transition back to available, but show briefly
                statusColor = '#6c757d'
                statusText = 'Deleted'
                break
            case 'DELETE_FAILED':
                statusColor = '#dc3545'
                statusText = 'Delete Failed'
                break
            case 'REVIEW_IN_PROGRESS':
                statusColor = '#6c757d'
                statusText = 'Review'
                showSpinner = true
                break
            default:
                // Fallback for linked stacks without specific status
                if (status.isLinked) {
                    statusColor = '#28a745'
                    statusText = 'Active'
                } else {
                    statusColor = '#007bff'
                    statusText = 'Linked'
                }
        }

        return (
            <span style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: statusColor,
                color: 'white',
                borderRadius: '4px',
                fontSize: '0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                minWidth: '80px',
                justifyContent: 'center'
            }}>
                {showSpinner && (
                    <span style={{
                        width: '12px',
                        height: '12px',
                        border: '2px solid white',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                )}
                {statusText}
            </span>
        )
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
            <div>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem'
                }}>
                    <div>
                        <h3 style={{ margin: 0 }}>Access Code Status Overview</h3>
                        <p style={{ margin: '0.5rem 0', color: '#666' }}>
                            {availableCount} of 60 Access Codes available • {linkedCount} linked to stacks
                        </p>
                    </div>
                    <div>
                        <button
                            onClick={handleRefresh}
                            disabled={isLoading}
                            style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                opacity: isLoading ? 0.6 : 1
                            }}
                        >
                            {isLoading ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {lastRefresh && (
                    <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                        Last updated: {formatDate(lastRefresh)}
                    </p>
                )}

                <ErrorDisplay
                    error={error}
                    onRetry={handleRefresh}
                    showRetryButton={true}
                />

                <div style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                }}>
                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.9rem'
                    }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa' }}>
                                <th style={{
                                    padding: '0.75rem',
                                    textAlign: 'left',
                                    borderBottom: '1px solid #ddd',
                                    position: 'sticky',
                                    top: 0,
                                    backgroundColor: '#f8f9fa'
                                }}>
                                    Access Code
                                </th>
                                <th style={{
                                    padding: '0.75rem',
                                    textAlign: 'left',
                                    borderBottom: '1px solid #ddd',
                                    position: 'sticky',
                                    top: 0,
                                    backgroundColor: '#f8f9fa'
                                }}>
                                    Status
                                </th>
                                <th style={{
                                    padding: '0.75rem',
                                    textAlign: 'left',
                                    borderBottom: '1px solid #ddd',
                                    position: 'sticky',
                                    top: 0,
                                    backgroundColor: '#f8f9fa'
                                }}>
                                    Stack Name
                                </th>
                                <th style={{
                                    padding: '0.75rem',
                                    textAlign: 'left',
                                    borderBottom: '1px solid #ddd',
                                    position: 'sticky',
                                    top: 0,
                                    backgroundColor: '#f8f9fa'
                                }}>
                                    Created At
                                </th>
                                <th style={{
                                    padding: '0.75rem',
                                    textAlign: 'center',
                                    borderBottom: '1px solid #ddd',
                                    position: 'sticky',
                                    top: 0,
                                    backgroundColor: '#f8f9fa',
                                    width: '120px'
                                }}>
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {accessCodeStatuses.map((status, index) => {
                                const isSelected = selectedAccessCode === status.accessCode
                                const isDeletable = isAccessCodeDeletable(status)

                                return (
                                    <tr key={status.accessCode} style={{
                                        backgroundColor: isSelected ? '#e3f2fd' :
                                            (index % 2 === 0 ? '#fff' : '#f8f9fa'),
                                        border: isSelected ? '2px solid #2196f3' : 'none'
                                    }}>
                                        <td style={{
                                            padding: '0.75rem',
                                            borderBottom: '1px solid #eee',
                                            fontFamily: 'monospace',
                                            fontSize: '0.8rem'
                                        }}>
                                            {status.accessCode}
                                        </td>
                                        <td style={{
                                            padding: '0.75rem',
                                            borderBottom: '1px solid #eee'
                                        }}>
                                            {getStatusBadge(status)}
                                        </td>
                                        <td style={{
                                            padding: '0.75rem',
                                            borderBottom: '1px solid #eee',
                                            fontFamily: 'monospace',
                                            fontSize: '0.8rem'
                                        }}>
                                            {status.stackName || '-'}
                                        </td>
                                        <td style={{
                                            padding: '0.75rem',
                                            borderBottom: '1px solid #eee'
                                        }}>
                                            {formatDate(status.createdAt)}
                                        </td>
                                        <td style={{
                                            padding: '0.75rem',
                                            borderBottom: '1px solid #eee',
                                            textAlign: 'center'
                                        }}>
                                            {bulkDeletionProgress[status.accessCode] ? (
                                                // Show bulk deletion progress
                                                <span style={{
                                                    fontSize: '0.8rem',
                                                    color: '#fd7e14',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.25rem'
                                                }}>
                                                    <span style={{
                                                        width: '10px',
                                                        height: '10px',
                                                        border: '2px solid #fd7e14',
                                                        borderTop: '2px solid transparent',
                                                        borderRadius: '50%',
                                                        animation: 'spin 1s linear infinite'
                                                    }} />
                                                    Bulk Delete
                                                </span>
                                            ) : isAccessCodeDeployable(status) ? (
                                                <button
                                                    onClick={() => handleDeployClick(status)}
                                                    disabled={isDeployingStack || isDeletingAll}
                                                    style={{
                                                        padding: '0.25rem 0.5rem',
                                                        backgroundColor: '#28a745',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8rem',
                                                        opacity: (isDeployingStack || isDeletingAll) ? 0.6 : 1
                                                    }}
                                                    title="Deploy stack to this Access Code"
                                                >
                                                    🚀 Deploy
                                                </button>
                                            ) : isDeletable ? (
                                                <button
                                                    onClick={() => handleDeleteClick(status)}
                                                    disabled={isDeletingStack || isDeletingAll}
                                                    style={{
                                                        padding: '0.25rem 0.5rem',
                                                        backgroundColor: '#dc3545',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8rem',
                                                        opacity: (isDeletingStack || isDeletingAll) ? 0.6 : 1
                                                    }}
                                                    title="Delete stack"
                                                >
                                                    🗑️ Delete
                                                </button>
                                            ) : status.isLinked ? (
                                                <span style={{
                                                    fontSize: '0.8rem',
                                                    color: '#6c757d',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.25rem'
                                                }}>
                                                    {(status.status === 'DELETE_IN_PROGRESS' ||
                                                        status.status === 'CREATE_IN_PROGRESS' ||
                                                        status.status === 'ROLLBACK_IN_PROGRESS' ||
                                                        status.status === 'UPDATE_IN_PROGRESS' ||
                                                        status.status === 'UPDATE_ROLLBACK_IN_PROGRESS' ||
                                                        status.status === 'REVIEW_IN_PROGRESS') && (
                                                            <span style={{
                                                                width: '10px',
                                                                height: '10px',
                                                                border: '2px solid #6c757d',
                                                                borderTop: '2px solid transparent',
                                                                borderRadius: '50%',
                                                                animation: 'spin 1s linear infinite'
                                                            }} />
                                                        )}
                                                    {status.status === 'DELETE_IN_PROGRESS' ? 'Deleting...' :
                                                        status.status === 'CREATE_IN_PROGRESS' ? 'Creating...' :
                                                            status.status === 'ROLLBACK_IN_PROGRESS' ? 'Rolling Back...' :
                                                                status.status === 'UPDATE_IN_PROGRESS' ? 'Updating...' :
                                                                    status.status === 'UPDATE_ROLLBACK_IN_PROGRESS' ? 'Update Rollback...' :
                                                                        status.status === 'REVIEW_IN_PROGRESS' ? 'In Review...' :
                                                                            status.status?.includes('FAILED') ? 'Error State' :
                                                                                'In Progress'}
                                                </span>
                                            ) : (
                                                <span style={{
                                                    fontSize: '0.8rem',
                                                    color: '#6c757d'
                                                }}>
                                                    -
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                <StackDeletionDialog
                    isOpen={showDeletionDialog}
                    accessCodeStatus={accessCodeToDelete}
                    onConfirm={handleDeleteConfirm}
                    onCancel={handleDeleteCancel}
                    isDeleting={isDeletingStack}
                />

                <StackDeploymentDialog
                    isOpen={showDeploymentDialog}
                    accessCodeStatus={accessCodeToDeploy}
                    onConfirm={handleDeployConfirm}
                    onCancel={handleDeployCancel}
                    isDeploying={isDeployingStack}
                />
            </div>
        </>
    )
}

export default AccessCodeStatusTable
